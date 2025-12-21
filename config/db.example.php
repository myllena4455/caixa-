<?php
class DB {
    public static function pdo(): PDO {
        static $pdo = null;
        if ($pdo) return $pdo;
        
        $host = 'seu_host_mysql';
        $db   = 'seu_banco_de_dados';
        $user = 'seu_usuario';
        $pass = 'sua_senha';
        
        $dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
        $opts = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        $pdo = new PDO($dsn, $user, $pass, $opts);
        return $pdo;
    }
}
