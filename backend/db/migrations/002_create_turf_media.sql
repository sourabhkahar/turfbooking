CREATE TABLE IF NOT EXISTS turf_media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turf_id INT NOT NULL,
    media_url TEXT NOT NULL,
    media_type ENUM('image', 'video') NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (turf_id) REFERENCES turfs(id) ON DELETE CASCADE
);
