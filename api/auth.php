<?php
// api/auth.php - Gerenciamento de sessão e autenticação

class Auth {
    
    // Inicia sessão se não estiver iniciada
    public static function startSession() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }
    
    // Autentica o usuário e cria sessão
    public static function login($user) {
        self::startSession();
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_name'] = $user['name'];
        $_SESSION['user_email'] = $user['email'];
        $_SESSION['user_role'] = $user['role'] ?? 'admin';
        $_SESSION['login_time'] = time();
    }
    
    // Verifica se o usuário está logado
    public static function check() {
        self::startSession();
        return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    }
    
    // Obtém o ID do usuário logado
    public static function getUserId() {
        self::startSession();
        return $_SESSION['user_id'] ?? null;
    }
    
    // Obtém dados do usuário logado
    public static function getUser() {
        self::startSession();
        if (!self::check()) return null;
        return [
            'id' => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'] ?? '',
            'email' => $_SESSION['user_email'] ?? '',
            'role' => $_SESSION['user_role'] ?? 'admin'
        ];
    }
    
    // Verifica se o usuário tem permissão
    public static function hasRole($roles) {
        if (!is_array($roles)) $roles = [$roles];
        $userRole = $_SESSION['user_role'] ?? 'funcionario';
        return in_array($userRole, $roles);
    }
    
    // Destrói a sessão (logout)
    public static function logout() {
        self::startSession();
        session_unset();
        session_destroy();
    }
    
    // Middleware de autenticação - para usar nas rotas protegidas
    public static function requireAuth() {
        if (!self::check()) {
            send_json(['message'=>'Não autenticado. Faça login.'], 401);
        }
    }
    
    // Middleware de permissão - verifica se tem a role necessária
    public static function requireRole($roles) {
        self::requireAuth();
        if (!self::hasRole($roles)) {
            send_json(['message'=>'Acesso negado. Permissão insuficiente.'], 403);
        }
    }
}
