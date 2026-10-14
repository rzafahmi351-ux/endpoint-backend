const db = require('../config/db');
const mqttClient = require('../config/mqtt');

// Threshold: device dianggap offline kalau last_seen > 45 detik
const OFFLINE_THRESHOLD_SECONDS = 45;
const CHECK_INTERVAL_MS = 30000; // 30 detik

// ============================================================
// Cek device yang offline
// ============================================================
async function checkOfflineDevices() {
    try {
        const [staleDevices] = await db.query(`
            SELECT 
                asset_id, asset_code, asset_name, category,
                last_seen, current_status, priority, pic_user_id
            FROM assets
            WHERE current_status = 'online'
              AND last_seen IS NOT NULL
              AND last_seen < NOW() - INTERVAL ? SECOND
        `, [OFFLINE_THRESHOLD_SECONDS]);

        if (staleDevices.length === 0) return;

        console.log(`⚠️  Found ${staleDevices.length} offline device(s)`);

        for (const device of staleDevices) {
            console.log(`🔴 Device offline: ${device.asset_code}`);

            // Update status + catat offline_since
            await db.query(
                `UPDATE assets 
                 SET current_status = 'offline', 
                     offline_since = NOW(),
                     updated_at = NOW()
                 WHERE asset_id = ?`,
                [device.asset_id]
            );

            // Insert incident
            await db.query(
                `INSERT INTO incidents 
                    (asset_id, detected_at, incident_type, description, severity, incident_status)
                 VALUES (?, NOW(), ?, ?, ?, 'open')`,
                [
                    device.asset_id,
                    'Device Offline',
                    `Device ${device.asset_code} (${device.asset_name}) tidak merespons sejak ${device.last_seen}`,
                    device.priority === 1 ? 'high' : 'medium'
                ]
            );

            // Insert notification
            if (device.pic_user_id) {
                await db.query(
                    `INSERT INTO notifications 
                        (user_id, asset_id, title, message, is_read)
                     VALUES (?, ?, ?, ?, 0)`,
                    [
                        device.pic_user_id,
                        device.asset_id,
                        `[ALERT OFFLINE] ${device.asset_code} Terputus`,
                        `Device ${device.asset_name} (${device.asset_code}) tidak merespons sejak ${device.last_seen}`
                    ]
                );
            }

            // Publish MQTT
            const alertPayload = {
                asset_code: device.asset_code,
                asset_name: device.asset_name,
                category: device.category,
                last_seen: device.last_seen,
                priority: device.priority,
                severity: device.priority === 1 ? 'high' : 'medium',
                timestamp: new Date().toISOString()
            };

            mqttClient.publish(
                `taims/alert/offline/${device.asset_code}`,
                JSON.stringify(alertPayload),
                { qos: 1, retain: false }
            );

            console.log(`📤 Alert published: taims/alert/offline/${device.asset_code}`);
        }
    } catch (err) {
        console.error('❌ Offline checker error:', err.message);
    }
}

// ============================================================
// Cek device yang recovery
// Cek: last_seen > offline_since (heartbeat masuk SETELAH offline)
// ============================================================
async function checkRecoveredDevices() {
    try {
        const [recovered] = await db.query(`
            SELECT 
                asset_id, asset_code, asset_name, category,
                last_seen, offline_since, current_status, pic_user_id
            FROM assets
            WHERE current_status = 'offline'
              AND offline_since IS NOT NULL
              AND last_seen > offline_since
        `);

        if (recovered.length === 0) return;

        console.log(`✅ Found ${recovered.length} recovered device(s)`);

        for (const device of recovered) {
            console.log(`🟢 Device recovered: ${device.asset_code}`);

            // Update status + clear offline_since
            await db.query(
                `UPDATE assets 
                 SET current_status = 'online', 
                     offline_since = NULL,
                     updated_at = NOW()
                 WHERE asset_id = ?`,
                [device.asset_id]
            );

            // Resolve incident
            await db.query(
                `UPDATE incidents 
                 SET incident_status = 'resolved'
                 WHERE asset_id = ? 
                   AND incident_type = 'Device Offline' 
                   AND incident_status IN ('open', 'investigating')`,
                [device.asset_id]
            );

            // Insert notification
            if (device.pic_user_id) {
                await db.query(
                    `INSERT INTO notifications 
                        (user_id, asset_id, title, message, is_read)
                     VALUES (?, ?, ?, ?, 0)`,
                    [
                        device.pic_user_id,
                        device.asset_id,
                        `[RECOVERY] ${device.asset_code} Kembali Normal`,
                        `Device ${device.asset_name} (${device.asset_code}) sudah kembali online`
                    ]
                );
            }

            // Publish MQTT
            const recoveryPayload = {
                asset_code: device.asset_code,
                asset_name: device.asset_name,
                category: device.category,
                recovered_at: new Date().toISOString(),
                timestamp: new Date().toISOString()
            };

            mqttClient.publish(
                `taims/alert/recovery/${device.asset_code}`,
                JSON.stringify(recoveryPayload),
                { qos: 1, retain: false }
            );

            console.log(`📤 Recovery published: taims/alert/recovery/${device.asset_code}`);
        }
    } catch (err) {
        console.error('❌ Recovery checker error:', err.message);
    }
}

// ============================================================
// Start checker
// ============================================================
function startOfflineChecker() {
    console.log('⏰ Offline checker started (interval: 30s, threshold: 45s)');

    checkOfflineDevices();
    checkRecoveredDevices();

    setInterval(async () => {
        await checkOfflineDevices();
        await checkRecoveredDevices();
    }, CHECK_INTERVAL_MS);
}

module.exports = { startOfflineChecker, checkOfflineDevices, checkRecoveredDevices };