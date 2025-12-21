<?php
// api/index.php
require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/auth.php';

// Inicia sessão
Auth::startSession();

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Normaliza base path /api
$base = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') ?: '/api';
$path = $uri;

// Remove prefix até /api
if (($pos = strpos($path, '/api')) !== false) {
    $path = substr($path, $pos + 4); // remove '/api'
}
$path = '/' . ltrim($path, '/');

// Rotas
if ($method === 'POST' && $path === '/auth/register') {
    $body = json_input();
    require_fields($body, ['name','email','password']);
    $pdo = DB::pdo();
    // e-mail único
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$body['email']]);
    if ($stmt->fetch()) send_json(['message'=>'E-mail já cadastrado'], 409);
    
    $pdo->beginTransaction();
    try {
        $hash = password_hash($body['password'], PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (name,email,password_hash) VALUES (?,?,?)")->execute([$body['name'],$body['email'],$hash]);
        $user_id = $pdo->lastInsertId();
        
        // Salva dados da loja se fornecidos
        if (!empty($body['store_name'])) {
            $pdo->prepare("INSERT INTO stores (user_id, store_name, owner_name, store_phone, cnpj, address) VALUES (?,?,?,?,?,?)")
                ->execute([
                    $user_id,
                    $body['store_name'] ?? '',
                    $body['owner_name'] ?? '',
                    $body['store_phone'] ?? '',
                    $body['cnpj'] ?? '',
                    $body['address'] ?? ''
                ]);
        }
        $pdo->commit();
        send_json(['message'=>'Usuário registrado com sucesso']);
    } catch (Exception $e) {
        $pdo->rollBack();
        send_json(['message'=>'Erro ao registrar usuário','error'=>$e->getMessage()], 500);
    }
}

if ($method === 'POST' && $path === '/auth/login') {
    $body = json_input();
    require_fields($body, ['email','password']);
    $pdo = DB::pdo();
    $stmt = $pdo->prepare("SELECT id,name,email,password_hash,role FROM users WHERE email = ?");
    $stmt->execute([$body['email']]);
    $u = $stmt->fetch();
    if (!$u || !password_verify($body['password'], $u['password_hash'])) {
        send_json(['message'=>'Credenciais inválidas'], 401);
    }
    // Cria sessão
    Auth::login($u);
    
    // Busca dados da loja se existir
    $stmt = $pdo->prepare("SELECT store_name, owner_name, store_phone, cnpj, address FROM stores WHERE user_id = ? LIMIT 1");
    $stmt->execute([$u['id']]);
    $store = $stmt->fetch();
    
    send_json([
        'message'=>'Login ok',
        'user'=>[
            'id'=>$u['id'],
            'name'=>$u['name'],
            'email'=>$u['email'],
            'role'=>$u['role'] ?? 'admin'
        ],
        'store'=>$store ?: null
    ]);
}

if ($method === 'POST' && $path === '/auth/logout') {
    Auth::logout();
    send_json(['message'=>'Logout realizado com sucesso']);
}

if ($method === 'GET' && $path === '/products') {
    Auth::requireAuth();
    $user_id = Auth::getUserId();
    $pdo = DB::pdo();
    $stmt = $pdo->prepare("SELECT id, name, cost, price, stock FROM products WHERE user_id = ? ORDER BY name");
    $stmt->execute([$user_id]);
    $rows = $stmt->fetchAll();
    send_json(['products'=>$rows]);
}

if ($method === 'POST' && $path === '/products') {
    Auth::requireRole(['admin', 'gerente']); // Apenas admin e gerente podem cadastrar produtos
    $body = json_input();
    require_fields($body, ['id','name','price','stock']);
    $user_id = Auth::getUserId();
    $cost = isset($body['cost']) ? floatval($body['cost']) : 0.0;
    $pdo = DB::pdo();
    // Verifica se já existe para este usuário
    $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ? AND user_id = ?");
    $stmt->execute([$body['id'], $user_id]);
    if ($stmt->fetch()) {
        // Atualiza produto existente
        $pdo->prepare("UPDATE products SET name=?, cost=?, price=?, stock=? WHERE id=? AND user_id=?")
            ->execute([$body['name'], $cost, $body['price'], $body['stock'], $body['id'], $user_id]);
        send_json(['message'=>'Produto atualizado com sucesso']);
    } else {
        // Insere novo produto
        $pdo->prepare("INSERT INTO products (id, user_id, name, cost, price, stock) VALUES (?,?,?,?,?,?)")
            ->execute([$body['id'], $user_id, $body['name'], $cost, $body['price'], $body['stock']]);
        send_json(['message'=>'Produto cadastrado com sucesso']);
    }
}

if ($method === 'DELETE' && preg_match('#^/products/([^/]+)$#', $path, $m)) {
    Auth::requireRole(['admin', 'gerente']); // Apenas admin e gerente podem deletar
    $id = $m[1];
    $user_id = Auth::getUserId();
    $pdo = DB::pdo();
    
    try {
        // Verifica se o produto existe
        $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);
        if (!$stmt->fetch()) {
            send_json(['message'=>'Produto não encontrado'], 404);
        }
        
        // Tenta deletar o produto
        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $user_id]);
        
        if ($stmt->rowCount() > 0) {
            send_json(['message'=>'Produto removido com sucesso']);
        } else {
            send_json(['message'=>'Não foi possível remover o produto'], 400);
        }
    } catch (PDOException $e) {
        // Se erro de constraint (produto tem vendas associadas)
        if (strpos($e->getMessage(), 'foreign key') !== false || $e->getCode() == '23000') {
            send_json(['message'=>'Não é possível deletar este produto porque ele tem vendas associadas. Você pode editar o estoque para 0 se quiser desativá-lo.'], 409);
        } else {
            send_json(['message'=>'Erro ao deletar produto: ' . $e->getMessage()], 500);
        }
    }
}

if ($method === 'POST' && $path === '/sales/finish') {
    Auth::requireAuth(); // Qualquer usuário logado pode fazer vendas
    $body = json_input();
    // Espera: { cart_items:[{id, name, price, qty}], total, payment_method, discount, additional, notes, customer_name, customer_cpf }
    require_fields($body, ['cart_items','total','payment_method']);
    $user_id = Auth::getUserId();
    $discount = isset($body['discount']) ? floatval($body['discount']) : 0.0;
    $additional = isset($body['additional']) ? floatval($body['additional']) : 0.0;
    $notes = isset($body['notes']) ? $body['notes'] : '';
    $customer_name = isset($body['customer_name']) ? $body['customer_name'] : '';
    $customer_cpf = isset($body['customer_cpf']) ? $body['customer_cpf'] : '';
    
    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
        $sale_id = bin2hex(random_bytes(8));
        $pdo->prepare("INSERT INTO sales (id, user_id, sale_date, total, payment_method, discount, additional, notes, customer_name, customer_cpf) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$sale_id, $user_id, $body['total'], $body['payment_method'], $discount, $additional, $notes, $customer_name, $customer_cpf]);
        $ins = $pdo->prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price_unit) VALUES (?,?,?,?)");
        $upd = $pdo->prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND user_id = ?");
        foreach ($body['cart_items'] as $it) {
            $ins->execute([$sale_id, $it['id'], $it['qty'], $it['price']]);
            $upd->execute([$it['qty'], $it['id'], $user_id]);
        }
        $pdo->commit();
        // Retorna payload compatível para o front imprimir a notinha
        send_json(['message'=>'Venda finalizada','sale_id'=>$sale_id,'sale_details'=>['sale_id'=>$sale_id,'sale_date'=>date('Y-m-d H:i:s'),'total'=>$body['total'],'payment_method'=>$body['payment_method'],'discount'=>$discount,'additional'=>$additional,'notes'=>$notes,'cart_items'=>$body['cart_items']]]);
    } catch (Exception $e) {
        $pdo->rollBack();
        send_json(['message'=>'Erro ao finalizar venda','error'=>$e->getMessage()], 500);
    }
}

if ($method === 'GET' && $path === '/sales/report') {
    Auth::requireAuth();
    // Filtros: ?from=YYYY-MM-DD&to=YYYY-MM-DD
    $from = $_GET['from'] ?? null;
    $to = $_GET['to'] ?? null;
    $user_id = Auth::getUserId();
    $pdo = DB::pdo();
    $sql = "SELECT id, sale_date, total, payment_method, discount FROM sales WHERE user_id = ?";
    $params = [$user_id];
    if ($from && $to) {
        $sql .= " AND sale_date BETWEEN ? AND ?";
        $params[] = $from . " 00:00:00";
        $params[] = $to . " 23:59:59";
    }
    $sql .= " ORDER BY sale_date DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    send_json(['sales'=>$rows]);
}

// Fallback
send_json(['message'=>'Rota não encontrada','path'=>$path], 404);
