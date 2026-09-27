@echo off
echo 🚀 Setting up Notion-Alt...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18 or higher.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Create .env file if it doesn't exist
if not exist .env (
    echo 🔧 Creating .env file...
    copy .env.example .env

    REM Generate a random secret (simple approach)
    for /f "tokens=1-6 delims= " %%a in ('wmic os get localdatetime ^| find "."') do (
        set datetime=%%a%%b%%c%%d%%e%%f
        goto :done
    )
    :done

    REM Update NEXTAUTH_SECRET in .env
    powershell -Command "(Get-Content .env) -replace 'your-secret-key-here-generate-with-openssl-rand-base64-32', '%datetime%' | Set-Content .env"

    echo ✅ .env file created with random secret
) else (
    echo ✅ .env file already exists
)

REM Set up Prisma
echo 🗄️  Setting up database...
call npx prisma generate
call npx prisma db push

echo.
echo ✨ Setup complete!
echo.
echo To start the development server, run:
echo   npm run dev
echo.
echo Then open http://localhost:3000 in your browser
pause
