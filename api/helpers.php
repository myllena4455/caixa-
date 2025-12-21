<?php
// api/helpers.php
function json_input() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function send_json($data, int $code=200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function require_fields($arr, $fields) {
    foreach ($fields as $f) {
        if (!isset($arr[$f]) || $arr[$f]==='') {
            send_json(['message'=>"Campo obrigatório ausente: $f"], 400);
        }
    }
}
