<?php
header("Content-Type: application/json");

// ================= VALIDASI =================
if (!isset($_GET['data'])) {
    echo json_encode([
        "status" => "error",
        "message" => "Missing parameter: data"
    ]);
    exit;
}

$data = trim($_GET['data']);

// ================= CEK PREFIX RFID =================
if (strpos($data, "rfid:") === 0) {
    $data = substr($data, 5); // hapus "rfid:"
}

// ================= CEK APAKAH JSON =================
$isJson = json_decode($data, true);
// ================= AMBIL FIREBASE URL =================
$db = "";
$urlFile = 'firebase_url.txt';

if (file_exists($urlFile)) {
    $db = trim(file_get_contents($urlFile));
}

if (empty($db)) {
    echo json_encode([
        "status" => "error",
        "message" => "Database URL is not configured. Please set it in the Dashboard Settings."
    ]);
    exit;
}

// Ensure no trailing slash to prevent double slashes later
$db = rtrim($db, '/');

// Cek apakah ada API Key
$authParam = "";
$apiKeyFile = 'firebase_apikey.txt';
if (file_exists($apiKeyFile)) {
    $apiKey = trim(file_get_contents($apiKeyFile));
    if (!empty($apiKey)) {
        // Firebase REST menggunakan argument auth=API_KEY
        $authParam = "?auth=" . $apiKey;
    }
}

// ================= JIKA DATA JSON (RFID LOG) =================
if ($isJson) {

    // Ensure required fields exist
    if (!isset($isJson['nama']) || !isset($isJson['uid']) || !isset($isJson['status'])) {
        echo json_encode([
            "status" => "error",
            "message" => "Missing required fields: nama, uid, status"
        ]);
        exit;
    }

    // Build clean payload - data consistency
    $payload = [
        "nama" => trim($isJson['nama']),
        "uid" => trim($isJson['uid']),
        "status" => strtolower(trim($isJson['status'])),
        "waktu_server" => date("Y-m-d H:i:s"),
        "timestamp" => time()
    ];

    // key unik
    $key = "entry" . time();

    $url = $db . "/iot/rfid/log/" . $key . ".json" . $authParam;

    $payload = json_encode($payload);

} else {

    // ================= FORMAT SENSOR BIASA =================
    if (!strpos($data, ":")) {
        echo json_encode([
            "status" => "error",
            "message" => "Format harus sensor:nilai"
        ]);
        exit;
    }

    list($sensor, $value) = explode(":", $data, 2);

    if (is_numeric($value)) {
        $value = $value + 0;
    }

    $url = $db . "/iot/" . urlencode($sensor) . ".json" . $authParam;
    $payload = json_encode($value);
}

// ================= KIRIM KE FIREBASE =================
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_CUSTOMREQUEST => "PUT",
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json'
    ],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false
]);

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

// ================= RESPONSE =================
if ($error) {
    echo json_encode([
        "status" => "curl_error",
        "message" => $error,
        "url" => $url
    ]);
    exit;
}

if ($httpcode != 200) {
    echo json_encode([
        "status" => "firebase_rejected",
        "http_code" => $httpcode,
        "response" => $response
    ]);
    exit;
}

echo json_encode([
    "status" => "success",
    "url" => $url,
    "http_code" => $httpcode
]);