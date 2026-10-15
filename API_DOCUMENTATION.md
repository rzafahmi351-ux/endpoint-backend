# T-AIMS Backend API Documentation
**Teknolab Asset & Infrastructure Monitoring System**  
**PT Teknolab Caraka Internasional**  
*PIC: Ahmad Reza Fahmi (Backend & API Developer - Shift 1)*

---

## 📌 Gambaran Umum
Dokumen ini merupakan panduan spesifikasi REST API backend T-AIMS untuk integrasi Frontend Dashboard (Dika Yoga / Ahmad Aziz), IoT Ingestion (Ilvina Muvarika), Network Monitoring (Ananda Dwi Susanti), dan Automasi Notifikasi (Arik).

* **Base URL**: `http://localhost:3000/api`
* **Default Port**: `3000`
* **Format Response**: JSON (`application/json`)
* **Timezone**: Waktu server (WIB / Local)

---

## 🔐 Autentikasi

Backend menggunakan 2 skema autentikasi:

### 1. JWT Authentication (Dashboard & Web App)
Digunakan untuk pengguna web (Admin, Viewer, PIC). Sertakan token pada request header:
```http
Authorization: Bearer <jwt_token>
```

### 2. Device API Key (IoT ESP32 & Monitoring Agent)
Digunakan oleh perangkat keras dan service monitoring untuk mengirim data/heartbeat secara aman tanpa login user:
```http
X-API-Key: <DEVICE_API_KEY>
```
*(Nilai default dev: dikonfigurasi di file `.env`)*

---

## 📋 Standar Response Format

### Sukses
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Pesan deskripsi error"
}
```

---

## 📑 Daftar Endpoint

### 1. Autentikasi (`/api/auth`)

#### `POST /api/auth/login`
Login pengguna untuk mendapatkan token JWT.
* **Auth**: Public
* **Request Body**:
```json
{
  "email": "admin@teknolab.id",
  "password": "password123"
}
```
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "expires_in": 86400,
    "user": {
      "user_id": 1,
      "full_name": "Administrator",
      "email": "admin@teknolab.id",
      "role": "super_admin"
    }
  }
}
```

#### `GET /api/auth/me`
Mendapatkan profil pengguna yang sedang login.
* **Auth**: Bearer Token
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "full_name": "Administrator",
    "email": "admin@teknolab.id",
    "role": "super_admin"
  }
}
```

#### `POST /api/auth/change-password`
Mengubah password pengguna yang sedang login.
* **Auth**: Bearer Token
* **Request Body**:
```json
{
  "old_password": "passwordLama",
  "new_password": "passwordBaru123"
}
```

#### `POST /api/auth/logout`
Logout pengguna (client menghapus token).
* **Auth**: Bearer Token

---

### 2. Heartbeat Perangkat (`/api/heartbeat`)

#### `POST /api/heartbeat`
Endpoint utama untuk ESP32, Raspberry Pi, dan gateway pengirim denyut status (Heartbeat).
* **Auth**: Header `X-API-Key: <DEVICE_API_KEY>`
* **Request Body**:
```json
{
  "device_id": "IOT-ESP-01",
  "status": "online",
  "ip_address": "192.168.1.150",
  "rssi": -65,
  "uptime_seconds": 12450,
  "firmware_version": "v1.0.2"
}
```
* **Response `200 OK`**:
```json
{
  "success": true,
  "message": "Heartbeat received",
  "status": "online",
  "next_heartbeat_in": 30
}
```

#### `GET /api/heartbeat/:assetCode/latest`
Mendapatkan data heartbeat terakhir untuk suatu aset tertentu.
* **Auth**: Bearer Token
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "asset_id": 5,
    "asset_code": "IOT-ESP-01",
    "asset_name": "ESP32 Sensor Suhu Server",
    "category": "IoT",
    "current_status": "online",
    "last_seen": "2026-10-15 08:30:00",
    "check_time": "2026-10-15 08:30:00",
    "details": {
      "ip_address": "192.168.1.150",
      "rssi": -65,
      "uptime_seconds": 12450,
      "firmware_version": "v1.0.2"
    }
  }
}
```

---

### 3. Aset & Registry (`/api/assets`)

#### `GET /api/assets`
Mengambil daftar aset dengan opsi filter, pencarian, dan pagination.
* **Auth**: Bearer Token
* **Query Parameters**:
  * `search`: Pencarian nama atau kode aset (contoh: `mikrotik`)
  * `category`: Filter kategori (`Server`, `Router`, `IoT`, `Switch`, `AP`, `PC`, dll.)
  * `status`: Filter status (`online`, `offline`, `warning`, `unknown`, `maintenance`)
  * `location_id`: Filter ID lokasi
  * `page`: Nomor halaman (default: `1`)
  * `limit`: Jumlah data per halaman (default: `20`)
* **Response `200 OK`**:
```json
{
  "success": true,
  "pagination": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  },
  "data": [
    {
      "asset_id": 1,
      "asset_code": "NET-RTR-01",
      "asset_name": "MikroTik CCR1009 Core Router",
      "category": "Router",
      "ip_address": "192.168.1.1",
      "mac_address": "CC:2D:E0:12:34:56",
      "location_id": 1,
      "location_name": "Server Room Lt. 2",
      "pic_user_id": 2,
      "pic_name": "Ahmad Reza Fahmi",
      "monitoring_method": "Ping",
      "current_status": "online",
      "priority": 1,
      "last_seen": "2026-10-15 08:40:12"
    }
  ]
}
```

#### `GET /api/assets/:id`
Mengambil detail satu aset lengkap dengan relasi lokasi & PIC.
* **Auth**: Bearer Token

#### `POST /api/assets`
Menambah aset baru ke dalam registry sistem.
* **Auth**: Bearer Token (Role: Admin / Super Admin)
* **Request Body**:
```json
{
  "asset_code": "NET-SW-02",
  "asset_name": "Switch Cisco Catalyst 2960",
  "category": "Switch",
  "ip_address": "192.168.1.10",
  "mac_address": "00:1B:D4:55:66:77",
  "location_id": 1,
  "pic_user_id": 2,
  "monitoring_method": "Ping",
  "priority": 2,
  "check_interval_seconds": 60,
  "description": "Switch distribusi lab iot"
}
```

#### `PUT /api/assets/:id`
Memperbarui data aset.
* **Auth**: Bearer Token (Role: Admin / Super Admin)

#### `DELETE /api/assets/:id`
Menghapus aset.
* **Auth**: Bearer Token (Role: Super Admin)

---

### 4. Dashboard & Analytics (`/api/dashboard`)

#### `GET /api/dashboard/stats`
Data agregasi ringkasan untuk kartu metrik dan widget dashboard utama.
* **Auth**: Bearer Token
* **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "total_devices": 36,
    "online": 32,
    "offline": 3,
    "unknown": 1,
    "maintenance": 0,
    "availability_percent": 88.89,
    "total_incidents_today": 2,
    "by_category": {
      "AP": 6,
      "IoT": 12,
      "Router": 3,
      "Server": 5,
      "Switch": 10
    },
    "last_updated": "2026-10-15 08:42:01"
  }
}
```

#### `GET /api/dashboard/uptime`
Kalkulasi uptime & downtime statistik per perangkat atau rentang tanggal.
* **Auth**: Bearer Token
* **Query Parameters**: `from`, `to`, `asset_id`

---

### 5. Network & Engine Monitoring (`/api/monitoring`)

Digunakan oleh Network Monitoring Engine (Ananda) untuk mencatat hasil pengecekan berkala.
* **Auth**: Header `X-API-Key: <DEVICE_API_KEY>`

#### `POST /api/monitoring/ping`
* **Request Body**:
```json
{
  "asset_id": 1,
  "status": "online",
  "response_time_ms": 1.45,
  "details": {
    "packet_loss": 0,
    "ip": "192.168.1.1"
  }
}
```

#### `POST /api/monitoring/http`
Health check HTTP endpoint/web service.
* **Request Body**:
```json
{
  "asset_id": 7,
  "status": "online",
  "response_time_ms": 120,
  "details": {
    "http_code": 200,
    "url": "http://192.168.1.20:8000/health"
  }
}
```

#### `POST /api/monitoring/tcp`
Health check konektivitas port TCP.

#### `GET /api/monitoring/logs`
Mengambil histori log monitoring (filter per `asset_id`, `status`, `from`, `to`).
* **Auth**: Bearer Token

#### `GET /api/monitoring/status/:assetId`
Status terkini perangkat beserta waktu respons dan metode cek terakhir.
* **Auth**: Bearer Token

---

### 6. Insiden & Gangguan (`/api/incidents`)

#### `GET /api/incidents`
Mengambil daftar riwayat insiden/gangguan jaringan dan perangkat.
* **Auth**: Bearer Token
* **Query Parameters**: `asset_id`, `status` (`open`, `investigating`, `resolved`), `severity` (`low`, `medium`, `high`, `critical`)

#### `POST /api/incidents`
Membuat tiket insiden manual atau otomatis.

#### `PUT /api/incidents/:id`
Memperbarui status insiden (contoh: resolve incident).

---

### 7. Lokasi (`/api/locations`)

#### `GET /api/locations`
Mengambil daftar ruangan/lokasi beserta jumlah aset aktif di lokasi tersebut.
* **Auth**: Bearer Token

#### `POST /api/locations`
Menambah lokasi baru.

---

### 8. Notifikasi (`/api/notifications`)

#### `GET /api/notifications`
Mengambil daftar notifikasi untuk user (alert offline, recovery, reminder maintenance).
* **Auth**: Bearer Token
* **Query Parameters**: `is_read` (`0` atau `1`), `limit`

#### `GET /api/notifications/unread-count`
Mengambil jumlah notifikasi yang belum dibaca (badge counter di navbar).
* **Auth**: Bearer Token

#### `PUT /api/notifications/:id/read`
Menandai notifikasi telah dibaca.
* **Auth**: Bearer Token

#### `PUT /api/notifications/mark-all-read`
Menandai seluruh notifikasi user sebagai telah dibaca.
* **Auth**: Bearer Token

---

### 9. Pencarian Global (`/api/search`)

#### `GET /api/search?q={keyword}`
Mencari entitas di seluruh database (aset, user, dan lokasi) sekaligus untuk navigasi cepat di navbar.
* **Auth**: Bearer Token
* **Query Param**: `q` (minimal 2 karakter)

---

## 📡 Integrasi MQTT & Background Services

Backend T-AIMS dilengkapi background engine otomatis:

### 1. Ingestion Heartbeat via MQTT
* **Topic Subscribe**: `taims/heartbeat/{asset_code}`
* **Payload JSON**:
```json
{
  "status": "online",
  "ip_address": "192.168.1.155",
  "rssi": -70,
  "uptime_seconds": 3600
}
```

### 2. Auto Offline Checker (`offline-checker.js`)
* **Interval Pengecekan**: Setiap **30 detik**
* **Threshold Timeout**: **45 detik** tanpa heartbeat
* **Otomasi saat Perangkat Mati**:
  1. Status aset diubah menjadi `offline` dan `offline_since = NOW()`.
  2. Otomatis membuat record baru di tabel `incidents` (severity: `high`/`medium`).
  3. Otomatis membuat record notifikasi untuk PIC di tabel `notifications`.
  4. Publish event alert ke MQTT: `taims/alert/offline/{asset_code}` (siap dikonsumsi n8n/Telegram bot oleh Arik).

### 3. Auto Recovery Checker
* Ketika perangkat kembali mengirim heartbeat:
  1. Status aset kembali diubah menjadi `online` dan `offline_since = NULL`.
  2. Status insiden otomatis di-update menjadi `resolved`.
  3. Publish event recovery ke MQTT: `taims/alert/recovery/{asset_code}`.

---

## 👥 Informasi Kontak & Kolaborasi Tim
* **Backend Engineer**: Ahmad Reza Fahmi (Shift 1)
* **Frontend Lead**: Dika Yoga (Shift 2)
* **System Integration**: Dzakwan (Shift 2 Lead)
* **Project Coordinator**: Damar Munajad (Shift 1 Lead)
