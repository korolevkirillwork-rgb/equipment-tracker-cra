New-Item -ItemType Directory -Path $path -Force | Out-Null
@'
# TROUBLESHOOTING — Equipment Tracker (Windows, CRA + TypeScript)
**Путь файла:** `C:\Users\Bo$$\equipment-tracker\docs\TROUBLESHOOTING.md`

## 1) Окружение и версии
- **Node.js:** 20 LTS (рекоменд.) → `node -v`
- **Пакеты:** из корня `C:\Users\Bo$$\equipment-tracker`  
  ```powershell
  npm install
  npm start
  Чек-лист первого запуска

env: C:\Users\Bo$$\equipment-tracker\.env

REACT_APP_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR-ANON-KEY


Типы CRA: C:\Users\Bo$$\equipment-tracker\src\react-app-env.d.ts

/// <reference types="react-scripts" />


Удалить тесты CRA (по умолчанию):

C:\Users\Bo$$\equipment-tracker\src\App.test.tsx
C:\Users\Bo$$\equipment-tracker\src\setupTests.ts


tsconfig: C:\Users\Bo$$\equipment-tracker\tsconfig.json

{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020","DOM","DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "noEmit": true,
    "baseUrl": "src"
  },
  "include": ["src"]
}

3) Частые ошибки и быстрые фиксы
TS1208: "cannot be compiled under '--isolatedModules'"

Причина: файл не распознан как модуль.

Фикс: убедиться, что есть import/export вверху; крайний случай — добавить в конец export {}.

Проверь src\react-app-env.d.ts (обязателен).

Cannot find module '@mui/material/Grid2'

Фикс (MUI v6):

import { Grid2 as Grid } from '@mui/material'


и установить MUI 6:

npm i @mui/material@^6 @mui/icons-material@^6 @emotion/react@^11 @emotion/styled@^11

ESLint: no-restricted-globals

confirm → window.confirm(...)

location.reload() → window.location.reload()

ESLint: react-hooks/exhaustive-deps

Оборачивай функции, что идут в deps, в React.useCallback(...) и указывай их в массиве зависимостей.

TS: toBeInTheDocument (Jest)

Удаляем test-файлы CRA (см. чек-лист выше).

TS2802 (spread Uint8Array) в src\utils\pdf.ts

Не использовать String.fromCharCode(...bytes.subarray(...)); вместо этого — обычный цикл по байтам.

React типы/дефинишены

Если ругается на типы React:

npm i -D @types/react @types/react-dom

4) Проблемы рантайма
Пустой экран / "ничего не рендерится"

Открой DevTools → Console на http://localhost:3000. Смотри первую ошибку.

Проверь, что переменные .env заданы (без них будут ошибки Supabase в Console).

Жёсткий ресет:

rd /s /q node_modules
del package-lock.json
npm install
npm start


Перезапусти TypeScript Server в VS Code: Ctrl+Shift+P → TypeScript: Restart TS server.

Supabase ошибки

"RLS" / "permission denied" — в dev мы отключаем RLS. Выполни SQL:
C:\Users\Bo$$\equipment-tracker\supabase\setup.sql в Supabase SQL Editor.

"не удалось создать отгрузку / id undefined" — проверь, что таблицы shipments и shipment_items созданы, поля совпадают, в .env валидные URL/KEY.

5) Шрифты и PDF (кириллица)

Мы встраиваем DejaVuSans из CDN. Если сеть режет CDN — положи файл локально:

Скопируй DejaVuSans.ttf в C:\Users\Bo$$\equipment-tracker\public\fonts\DejaVuSans.ttf

В src\utils\pdf.ts загружай /fonts/DejaVuSans.ttf вместо CDN-URL.

Проверяй, что в PDF doc.setFont('DejaVu') после addFont.

6) Порты и запуск

CRA слушает http://localhost:3000.

Сменить порт:

$env:PORT=3001; npm start

7) Полезные команды (PowerShell)
# Из корня проекта
cd "C:\Users\Bo$$\equipment-tracker"

# Полный ресет зависимостей
rd /s /q node_modules; del package-lock.json; npm install

# Установка ключевых пакетов
npm i @mui/material @mui/icons-material @emotion/react @emotion/styled react-router-dom @supabase/supabase-js jspdf jspdf-autotable date-fns
npm i -D @types/jspdf @types/react @types/react-dom

# Запуск dev
npm start

8) Улучшения на будущее (рекомендации)

TanStack Query — кеш/рефетч Supabase.

Zod — валидация форм и API.

React Hook Form — формы без лишних ререндеров.

RLS-политики в Supabase — безопасный прод.

CI: npm run build и деплой артефактов (S3/CloudFront/Netlify).

'@ | Set-Content -Path (Join-Path $path 'TROUBLESHOOTING.md') -Encoding UTF8
Write-Host "Создано: $path\TROUBLESHOOTING.md"