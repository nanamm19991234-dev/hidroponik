<?php
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);

if (!isset($input['firebase_url'])) {
    echo json_encode(["status" => "error", "message" => "Firebase URL is required."]);
    exit;
}

$firebase_url = trim($input['firebase_url']);
$firebase_apikey = isset($input['firebase_apikey']) ? trim($input['firebase_apikey']) : "";

// Write URL
if (file_put_contents('firebase_url.txt', $firebase_url) === false) {
    echo json_encode(["status" => "error", "message" => "Failed to write firebase_url.txt. Check write permissions."]);
    exit;
}

// Write API Key
if (file_put_contents('firebase_apikey.txt', $firebase_apikey) === false) {
    echo json_encode(["status" => "error", "message" => "Failed to write firebase_apikey.txt. Check write permissions."]);
    exit;
}

echo json_encode(["status" => "success", "message" => "Configurations saved successfully."]);
