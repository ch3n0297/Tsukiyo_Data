# Quickstart: 內部登入與註冊系統

## 啟動

```bash
export API_SHARED_SECRET=local-dev-secret
export BOOTSTRAP_ADMIN_EMAIL=admin@example.com
export BOOTSTRAP_ADMIN_PASSWORD=AdminPassword123!
npm start
```

## 註冊

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/register \
  -H "content-type: application/json" \
  -d '{"display_name":"王小明","email":"member@example.com","password":"MemberPassword123!"}'
```

## 登入

```bash
curl -i -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPassword123!"}'
```

## 忘記密碼

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/forgot-password \
  -H "content-type: application/json" \
  -d '{"email":"member@example.com"}'
```

重設連結會寫入 `data/outbox-messages.json`。
