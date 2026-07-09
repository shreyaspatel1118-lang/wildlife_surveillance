Quick instructions for the GridFS gallery server

1. Install dependencies (from `scripts/`):

```bash
cd scripts
npm install
```

2. Create `.env` from `.env.example` and set `MONGO_URI`.

3. Run the server:

```bash
node mongo_server.js
```

4. Upload an image (multipart form field `image`):

```bash
curl -X POST -F "image=@/path/to/photo.jpg" http://localhost:3001/upload
```

5. Mark an uploaded file classified (use returned id):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"label":"elephant"}' http://localhost:3001/classify/<id>
```

6. Open the gallery at http://localhost:3001/gallery.html
