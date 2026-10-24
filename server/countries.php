<?php
// Visitor countries for sn1p.win. Stores only per-country counts: no IP addresses, no cookies.
//   GET  -> summary        POST -> count this visit, then summary
header('Content-Type: application/json');
header('Cache-Control: no-store');

const DIR = '/var/lib/sn1p-geo';
const COUNTS = DIR . '/counts.json';
const GEO = DIR . '/geo.bin';
const REC = 34;

function lookup(string $ip): ?string {
    $b = @inet_pton($ip);
    if ($b === false) return null;
    if (strlen($b) === 4) $b = str_repeat("\0", 10) . "\xff\xff" . $b;
    $f = @fopen(GEO, 'rb');
    if (!$f) return null;
    $size = filesize(GEO);
    $lo = 0;
    $hi = intdiv($size, REC) - 1;
    $cc = null;
    while ($lo <= $hi) {
        $mid = intdiv($lo + $hi, 2);
        fseek($f, $mid * REC);
        $r = fread($f, REC);
        if (strlen($r) < REC) break;
        $start = substr($r, 0, 16);
        $end = substr($r, 16, 16);
        if (strcmp($b, $start) < 0) { $hi = $mid - 1; }
        elseif (strcmp($b, $end) > 0) { $lo = $mid + 1; }
        else { $cc = substr($r, 32, 2); break; }
    }
    fclose($f);
    return ($cc && preg_match('/^[A-Z]{2}$/', $cc) && $cc !== 'ZZ') ? $cc : null;
}

function summary(array $j): array {
    arsort($j['countries']);
    $top = [];
    foreach (array_slice($j['countries'], 0, 10, true) as $c => $n) $top[] = [$c, $n];
    return ['since' => $j['since'], 'visits' => $j['visits'], 'countries' => count($j['countries']), 'top' => $top];
}

$fresh = ['since' => gmdate('Y-m-d'), 'visits' => 0, 'countries' => []];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '' && !in_array($origin, ['https://sn1p.win', 'https://www.sn1p.win'], true)) { http_response_code(403); echo '{"error":"forbidden"}'; exit; }
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $cc = preg_match('/bot|crawl|spider|preview|curl|wget|headless|python/i', $ua) ? null : lookup($_SERVER['REMOTE_ADDR'] ?? '');

    $fp = fopen(COUNTS, 'c+');
    if (!$fp) { http_response_code(500); echo '{"error":"storage"}'; exit; }
    flock($fp, LOCK_EX);
    $j = json_decode(stream_get_contents($fp), true);
    if (!is_array($j) || !isset($j['countries'])) $j = $fresh;
    if ($cc) {
        $j['countries'][$cc] = ($j['countries'][$cc] ?? 0) + 1;
        $j['visits']++;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($j));
    }
    flock($fp, LOCK_UN);
    fclose($fp);
    echo json_encode(summary($j));
    exit;
}

$j = is_file(COUNTS) ? json_decode(file_get_contents(COUNTS), true) : null;
if (!is_array($j) || !isset($j['countries'])) $j = $fresh;
echo json_encode(summary($j));
