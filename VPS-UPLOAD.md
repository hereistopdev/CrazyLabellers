# VPS video storage + auto-upload

Upload videos from **Admin → Videos** on `https://crazylabel.us`. When VPS env vars are set on Render, the backend:

1. Receives the `.mp4` from your browser
2. Uploads it to your Linux VPS over **SFTP**
3. Creates a `VideoAssignment` in MongoDB with `videoUrl` pointing at `https://media.crazylabel.us/...`

No manual `scp` or local import needed.

---

## 1. VPS one-time setup

```bash
sudo mkdir -p /var/www/football-clips
sudo mkdir -p /var/www/football-images
sudo chmod 755 /var/www/football-clips /var/www/football-images
```

Configure nginx + SSL for `media.crazylabel.us`:

```bash
sudo nano /etc/nginx/sites-available/media.crazylabel.us
```

```nginx
server {
    listen 80;
    server_name media.crazylabel.us;
    root /var/www/football-clips;

    location /api/videos/ {
        alias /var/www/football-clips/;
        types { video/mp4 mp4; }
        default_type video/mp4;

        # Required for full playback + seeking in the browser
        add_header Accept-Ranges bytes always;
        add_header Access-Control-Allow-Origin * always;
        add_header Cache-Control "public, max-age=86400";

        sendfile on;
        tcp_nopush on;
        aio on;
        directio 512;
    }

    location /api/images/ {
        alias /var/www/football-images/;
        types {
            image/jpeg jpg jpeg;
            image/png png;
            image/webp webp;
            image/gif gif;
        }
        add_header Access-Control-Allow-Origin * always;
        add_header Cache-Control "public, max-age=86400";
    }

    location / { return 404; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/media.crazylabel.us /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d media.crazylabel.us
```

Test range requests (must return `206 Partial Content`):

```bash
curl -I -H "Range: bytes=0-1023" https://media.crazylabel.us/api/videos/YOUR_CLIP_ID.mp4
```

---

## 2. SSH key for Render

On your PC:

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\labeling-vps -N '""'
```

Copy public key to VPS:

```powershell
type $env:USERPROFILE\.ssh\labeling-vps.pub | ssh root@YOUR_VPS_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Test:

```powershell
ssh -i $env:USERPROFILE\.ssh\labeling-vps root@YOUR_VPS_IP
```

---

## 3. Render environment variables

In **Render → backend → Environment**, add:

| Key | Example |
|-----|---------|
| `VIDEO_BASE_URL` | `https://media.crazylabel.us` |
| `VPS_SSH_HOST` | VPS IP or `media.crazylabel.us` |
| `VPS_SSH_PORT` | `22` |
| `VPS_SSH_USER` | `root` |
| `VPS_VIDEO_DIR` | `/var/www/football-clips` |
| `VPS_IMAGE_DIR` | `/var/www/football-images` |
| `VPS_SSH_PRIVATE_KEY` | Full private key (see below) |

**Private key on Render:** paste the key as one line with `\n` where line breaks go:

```
-----BEGIN OPENSSH PRIVATE KEY-----\nMIIE...\n-----END OPENSSH PRIVATE KEY-----\n
```

Or use `VPS_SSH_PASSWORD` instead (less secure).

Remove `VIDEO_DATA_DIR` and `IMAGE_DATA_DIR` from Render if present.

When VPS vars are set, **video and image admin uploads** are stored on the VPS over SFTP. Image URLs point at `VIDEO_BASE_URL/api/images/...` (same media host as videos).

Redeploy Render.

---

## 4. Verify

1. Log in as admin on `https://crazylabel.us`
2. **Admin → Videos**
3. Banner should say **“VPS storage connected”**
4. Upload a test `.mp4`
5. Success: “Video uploaded to VPS and added to the app”
6. On VPS: `ls /var/www/football-clips`
7. Open the task as a labeller — video plays from `media.crazylabel.us`

For cricket image tasks (**Admin → Image tasks**):

8. Upload a test image + JSON pair
9. On VPS: `ls /var/www/football-images`
10. Open the image group as a labeller — image loads from `media.crazylabel.us/api/images/...`

---

## 5. Sync existing VPS clips

If you already copied files to the VPS manually:

- Click **“Sync VPS clips to app”** on Admin → Videos  
- Registers any `.mp4` on the VPS that are not yet in MongoDB

---

## Local development

Without VPS vars, uploads save to `VIDEO_DATA_DIR` on your PC (same as before).

To test VPS upload locally, add the same `VPS_*` vars to `backend/.env`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| “VPS storage is not configured” | Add `VPS_SSH_HOST` + key/password on Render |
| Connection timeout | Open port 22 on VPS firewall; check `VPS_SSH_HOST` |
| Permission denied | Verify public key in VPS `~/.ssh/authorized_keys` |
| Video uploads but won’t play | Check nginx on `media.crazylabel.us` and `VIDEO_BASE_URL` |
| Only first 2–3 seconds play | nginx must send `Accept-Ranges: bytes`; test with `curl -I -H "Range: bytes=0-1023" ...` → expect **206** |
| Upload works, import finds 0 | Clips must be valid 30-char hex `.mp4` names |
