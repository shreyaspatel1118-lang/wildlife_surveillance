const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const axios = require("axios");
const FormData = require('form-data');
const nodemailer = require('nodemailer');

// Load environment variables from .env if present
require('dotenv').config();

const app = express();

const PORT = 3000;
const PYTHON_API_URL = "http://localhost:5000";

// ==========================
// CREATE UPLOADS FOLDER
// ==========================

const uploadDir = path.join(__dirname, "..", "output_evidence");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// ==========================
// SERVE STATIC FILES
// ==========================

app.use(express.static(__dirname));

app.use(
    "/uploads",
    express.static(uploadDir)
);

// Serve frontend assets from the web folder (prod.css, dashboard.js, etc.)
app.use(
    "/assets",
    express.static(path.join(__dirname, "..", "web", "assets"))
);

// ==========================
// EMAIL NOTIFICATIONS
// ==========================

async function sendNotificationEmail(to, subject, text, attachments=[]) {
    let transporter;
    let usingTestAccount = false;
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true';

    if (host && port && user && pass) {
        transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    } else {
        // Create an ethereal test account for development if SMTP not configured
        try {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, secure: false, auth: { user: testAccount.user, pass: testAccount.pass } });
            usingTestAccount = true;
            console.log('[email] Using Ethereal test account for preview');
        } catch (e) {
            console.log('[email] SMTP not configured and failed to create test account, skipping email send');
            return { sent: false, previewUrl: null };
        }
    }

    try {
        const fromAddr = process.env.SMTP_FROM || (user || 'no-reply@localhost');
        const info = await transporter.sendMail({ from: fromAddr, to, subject, text, attachments });
        console.log('[email] Sent notification:', info.messageId);
        const previewUrl = usingTestAccount ? nodemailer.getTestMessageUrl(info) : null;
        if (previewUrl) console.log('[email] Preview URL:', previewUrl);
        return { sent: true, previewUrl };
    } catch (e) {
        console.warn('[email] Send failed:', e.message);
        return { sent: false, previewUrl: null };
    }
}

// ==========================
// HEALTH CHECK
// ==========================

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        python_api: "checking...",
    });
});

// ==========================
// IMAGE UPLOAD API
// ==========================

app.post("/upload", (req, res) => {
    let imageBuffer = Buffer.alloc(0);

    req.on("data", (chunk) => {
        imageBuffer = Buffer.concat([imageBuffer, chunk]);
    });

    req.on("end", async () => {
        try {
            if (imageBuffer.length === 0) {
                return res.status(400).json({ error: "No image data received" });
            }

            // Save original image
            const originalPath = path.join(uploadDir, "latest.jpg");
            fs.writeFileSync(originalPath, imageBuffer);

            console.log(
                `[${new Date().toLocaleTimeString()}] [IMG] Image received (${imageBuffer.length} bytes)`
            );

            // Send to Python inference API
            try {
                console.log(
                    `[${new Date().toLocaleTimeString()}] [*] Running YOLO inference...`
                );

                const inferenceResponse = await axios.post(
                    `${PYTHON_API_URL}/detect`,
                    imageBuffer,
                    {
                        headers: {
                            "Content-Type": "application/octet-stream",
                        },
                        timeout: 30000,
                    }
                );

                console.log(
                    `[${new Date().toLocaleTimeString()}] [OK] Detection complete: ${
                        inferenceResponse.data.detection_count
                    } objects found`
                );

                // Send email notification if requested and detections found
                let emailResult = { sent: false, previewUrl: null };
                try {
                    const detCount = inferenceResponse.data.detection_count || 0;
                    const notifyEmailHeader = req.headers['x-notify-email'];
                    const notifyEmailEnv = process.env.NOTIFY_EMAIL;
                    const notifyTo = (notifyEmailHeader && notifyEmailHeader.trim()) || (notifyEmailEnv && notifyEmailEnv.trim()) || null;
                    if (detCount > 0 && notifyTo) {
                        const classes = (inferenceResponse.data.class_names || []).join(', ') || 'unknown';
                        const subject = `Aranya Alert — ${detCount} detection(s): ${classes}`;
                        const text = `Detections: ${classes}\nCount: ${detCount}\nImage: http://localhost:${PORT}/uploads/latest.jpg`;
                        // Synchronously send email for testing and return preview URL in response
                        try {
                            emailResult = await sendNotificationEmail(notifyTo, subject, text, [{ filename: 'latest.jpg', path: originalPath }]);
                            console.log('[email] sent result:', notifyTo, emailResult);
                        } catch (e) {
                            console.warn('[email] failed send', e && e.message);
                        }
                    }
                } catch (e) {
                    console.warn('[email] notify check failed', e && e.message);
                }

                // Return detection results
                // Forward saved image to the gallery server only when detections were found
                (async () => {
                    try {
                        const detCount = inferenceResponse.data.detection_count || 0;
                        if (detCount <= 0) {
                            console.log(`[${new Date().toLocaleTimeString()}] [SKIP] No detections — skipping gallery upload`);
                            return;
                        }

                        const galleryUploadUrl = process.env.GALLERY_UPLOAD_URL || 'http://localhost:3001/upload';
                        const label = (inferenceResponse.data.class_names && inferenceResponse.data.class_names.length > 0)
                            ? inferenceResponse.data.class_names[0]
                            : 'detected';

                        const uploads = [];
                        const filePath = originalPath;
                        if (fs.existsSync(filePath)) {
                            try {
                                const form = new FormData();
                                form.append('image', fs.createReadStream(filePath));
                                form.append('source', 'original');
                                const uploadResp = await axios.post(galleryUploadUrl, form, { headers: form.getHeaders(), timeout: 10000 });
                                if (uploadResp.data && uploadResp.data.id) uploads.push({ id: uploadResp.data.id, kind: 'original' });
                            } catch (e) {
                                console.warn('Upload original failed:', e.message);
                            }
                        }


                        // Upload annotated image if present
                        const annotatedPath = path.join(uploadDir, 'latest_annotated.jpg');
                        if (fs.existsSync(annotatedPath)) {
                            try {
                                const formA = new FormData();
                                formA.append('image', fs.createReadStream(annotatedPath));
                                formA.append('source', 'annotated');
                                const uploadRespA = await axios.post(galleryUploadUrl, formA, { headers: formA.getHeaders(), timeout: 10000 });
                                if (uploadRespA.data && uploadRespA.data.id) uploads.push({ id: uploadRespA.data.id, kind: 'annotated' });
                            } catch (e) {
                                console.warn('Upload annotated failed:', e.message);
                            }
                        } else {
                            console.log(`[${new Date().toLocaleTimeString()}] [WARN] Annotated image not found at ${annotatedPath}`);
                        }

                        // Mark uploaded items as classified with the same label
                        for (const u of uploads) {
                            try {
                                const galleryClassifyUrl = (process.env.GALLERY_BASE_URL || 'http://localhost:3001') + `/classify/${u.id}`;
                                await axios.post(galleryClassifyUrl, { label }, { timeout: 5000 }).catch(e => console.warn('classify failed', e.message));
                            } catch (e) {
                                console.warn('Mark classified failed for', u.id, e.message);
                            }
                        }
                    } catch (e) {
                        console.warn('Forward to gallery failed:', e.message);
                    }
                })();

                res.status(200).json({
                    status: "success",
                    timestamp: new Date().toISOString(),
                    detections: inferenceResponse.data.detections,
                    detection_count: inferenceResponse.data.detection_count,
                    class_names: inferenceResponse.data.class_names,
                    human_detected: !!inferenceResponse.data.human_detected,
                    detection_mode: inferenceResponse.data.detection_mode || "wildlife",
                    images: {
                        original: "/uploads/latest.jpg",
                        annotated: "/uploads/latest_annotated.jpg",
                    },
                    email_result: typeof emailResult !== 'undefined' ? emailResult : { sent: false, previewUrl: null }
                });
            } catch (inferenceError) {
                console.error(
                    `[${new Date().toLocaleTimeString()}] [ERR] Inference error:`,
                    inferenceError.message
                );

                // Return error but still confirm image was saved
                res.status(500).json({
                    error: "Inference failed",
                    message:
                        inferenceError.message ||
                        "Could not connect to Python API",
                    images: {
                        original: "/uploads/latest.jpg",
                    },
                });
            }
        } catch (err) {
            console.error(
                `[${new Date().toLocaleTimeString()}] [ERR] Error:`,
                err.message
            );
            res.status(500).json({ error: err.message });
        }
    });

    req.on("error", (err) => {
        console.error(
            `[${new Date().toLocaleTimeString()}] [ERR] Request error:`,
            err.message
        );
        res.status(500).json({ error: "Failed to process upload" });
    });
});

// ==========================
// GET LATEST RESULTS
// ==========================

app.get("/latest-results", (req, res) => {
    const jsonPath = path.join(uploadDir, "latest.json");

    if (!fs.existsSync(jsonPath)) {
        return res.status(404).json({ error: "No results yet" });
    }

    try {
        const results = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
        res.status(200).json(results);
    } catch (err) {
        res.status(500).json({ error: "Failed to read results" });
    }
});

// ==========================
// SERVE DASHBOARD HTML
// ==========================

app.get("/", (req, res) => {
    // Prefer a dashboard inside src/server, but fall back to the project's web folder
    const dashboardPathServer = path.join(__dirname, "dashboard.html");
    const dashboardPathWeb = path.join(__dirname, "..", "web", "dashboard.html");
    if (fs.existsSync(dashboardPathServer)) {
        res.sendFile(dashboardPathServer);
    } else if (fs.existsSync(dashboardPathWeb)) {
        res.sendFile(dashboardPathWeb);
    } else {
        res.send("<h1>Dashboard not found. Create dashboard.html in scripts/ or web/ folder</h1>");
    }
});

// ==========================
// SERVE GALLERY PAGE
// ==========================

app.get("/gallery", (req, res) => {
    // Prefer a gallery page inside src/server, but fall back to the project's web folder
    const galleryPathServer = path.join(__dirname, "gallery-page.html");
    const galleryPathWeb = path.join(__dirname, "..", "web", "gallery-page.html");
    if (fs.existsSync(galleryPathServer)) {
        res.sendFile(galleryPathServer);
    } else if (fs.existsSync(galleryPathWeb)) {
        res.sendFile(galleryPathWeb);
    } else {
        res.send("<h1>Gallery not found. Create gallery-page.html in scripts/ or web/ folder</h1>");
    }
});

// ==========================
// GALLERY API PROXY
// ==========================

app.get("/api/gallery", async (req, res) => {
    try {
        const galleryResponse = await axios.get("http://localhost:3001/gallery");
        const images = galleryResponse.data;
        
        // Transform relative URLs to absolute URLs
        const transformedImages = images.map(img => ({
            ...img,
            url: img.url.startsWith('http') ? img.url : `http://localhost:3001${img.url}`
        }));
        
        res.json(transformedImages);
    } catch (error) {
        console.error("Failed to fetch gallery:", error.message);
        res.status(500).json({ error: "Failed to load gallery", details: error.message });
    }
});

// ==========================
// START SERVER
// ==========================

app.listen(PORT, "0.0.0.0", () => {
    console.log("\n[*] Aranya Surveillance Server started!");
    console.log(`[*] Dashboard: http://localhost:${PORT}`);
    console.log(`[*] Gallery: http://localhost:${PORT}/gallery`);
    console.log(`[*] Upload Endpoint: http://localhost:${PORT}/upload`);
    console.log(`[*] Python API: ${PYTHON_API_URL}`);
    console.log(`[*] Results: http://localhost:${PORT}/latest-results\n`);
});
