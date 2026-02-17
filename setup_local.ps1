# ============================================================
# NomadGo SpatialVision - سكربت تجهيز المشروع على الكمبيوتر المحلي
# شغّل هذا السكربت في PowerShell كمسؤول (Administrator)
# ============================================================

param(
    [string]$ProjectPath = "$env:USERPROFILE\Documents\NomadGo-SpatialVision",
    [string]$UnityVersion = "2022.3"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NomadGo SpatialVision - Local Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- الخطوة 1: التحقق من Unity Hub ---
Write-Host "[1/7] التحقق من Unity Hub..." -ForegroundColor Yellow

$unityHubPath = "${env:ProgramFiles}\Unity Hub\Unity Hub.exe"
$unityHubAlt = "${env:ProgramFiles(x86)}\Unity Hub\Unity Hub.exe"

if (Test-Path $unityHubPath) {
    Write-Host "  Unity Hub موجود: $unityHubPath" -ForegroundColor Green
} elseif (Test-Path $unityHubAlt) {
    Write-Host "  Unity Hub موجود: $unityHubAlt" -ForegroundColor Green
    $unityHubPath = $unityHubAlt
} else {
    Write-Host "  Unity Hub غير موجود. جاري التحميل..." -ForegroundColor Red
    $hubUrl = "https://public-cdn.cloud.unity3d.com/hub/prod/UnityHubSetup.exe"
    $hubInstaller = "$env:TEMP\UnityHubSetup.exe"
    Invoke-WebRequest -Uri $hubUrl -OutFile $hubInstaller
    Write-Host "  تم التحميل. يرجى تثبيت Unity Hub يدوياً من: $hubInstaller" -ForegroundColor Yellow
    Write-Host "  بعد التثبيت، أعد تشغيل هذا السكربت." -ForegroundColor Yellow
    Start-Process $hubInstaller
    exit
}

# --- الخطوة 2: التحقق من Unity Editor ---
Write-Host "[2/7] التحقق من Unity Editor..." -ForegroundColor Yellow

$unityEditors = Get-ChildItem "${env:ProgramFiles}\Unity\Hub\Editor" -ErrorAction SilentlyContinue
$targetEditor = $unityEditors | Where-Object { $_.Name -like "$UnityVersion*" } | Select-Object -First 1

if ($targetEditor) {
    $unityExe = Join-Path $targetEditor.FullName "Editor\Unity.exe"
    Write-Host "  Unity $($targetEditor.Name) موجود" -ForegroundColor Green
} else {
    Write-Host "  Unity $UnityVersion غير مثبت." -ForegroundColor Red
    Write-Host "  افتح Unity Hub وثبّت Unity $UnityVersion LTS مع Android Build Support" -ForegroundColor Yellow
    Write-Host "  تأكد من تفعيل: Android SDK & NDK Tools, OpenJDK" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  بعد التثبيت، أعد تشغيل هذا السكربت." -ForegroundColor Yellow
    exit
}

# --- الخطوة 3: إنشاء مجلد المشروع ---
Write-Host "[3/7] إنشاء هيكل المشروع في: $ProjectPath" -ForegroundColor Yellow

$folders = @(
    "Assets\Models",
    "Assets\Plugins",
    "Assets\Resources",
    "Assets\Scenes",
    "Assets\Scripts\AppShell",
    "Assets\Scripts\AROverlay",
    "Assets\Scripts\Counting",
    "Assets\Scripts\Diagnostics",
    "Assets\Scripts\Spatial",
    "Assets\Scripts\Storage",
    "Assets\Scripts\Sync",
    "Assets\Scripts\Vision",
    "Assets\StreamingAssets",
    "Docs",
    "Packages",
    "ProjectSettings"
)

foreach ($folder in $folders) {
    $fullPath = Join-Path $ProjectPath $folder
    if (!(Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
    }
}
Write-Host "  تم إنشاء جميع المجلدات" -ForegroundColor Green

# --- الخطوة 4: إنشاء manifest.json للحزم ---
Write-Host "[4/7] إنشاء ملف الحزم (Packages)..." -ForegroundColor Yellow

$manifest = @'
{
  "dependencies": {
    "com.unity.xr.arcore": "5.1.2",
    "com.unity.xr.arfoundation": "5.1.2",
    "com.unity.xr.management": "4.4.0",
    "com.unity.inputsystem": "1.7.0",
    "com.unity.textmeshpro": "3.0.6",
    "com.unity.ugui": "1.0.0",
    "com.unity.modules.ui": "1.0.0",
    "com.unity.modules.unitywebrequest": "1.0.0",
    "com.unity.modules.unitywebrequestjson": "1.0.0"
  }
}
'@

$manifest | Out-File -FilePath (Join-Path $ProjectPath "Packages\manifest.json") -Encoding UTF8
Write-Host "  تم إنشاء manifest.json" -ForegroundColor Green

# --- الخطوة 5: إنشاء ProjectSettings ---
Write-Host "[5/7] إنشاء إعدادات المشروع (ProjectSettings)..." -ForegroundColor Yellow

$projectSettings = @'
%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!129 &1
PlayerSettings:
  productName: NomadGo SpatialVision
  companyName: NomadGo
  defaultScreenWidth: 1080
  defaultScreenHeight: 1920
  androidMinSdkVersion: 29
  androidTargetSdkVersion: 34
  scriptingBackend: 1
  targetArchitectures: 1
  ARCoreEnabled: 1
  stripUnusedMeshComponents: 1
  applicationIdentifier:
    Android: com.nomadgo.spatialvision
'@

$projectSettings | Out-File -FilePath (Join-Path $ProjectPath "ProjectSettings\ProjectSettings.asset") -Encoding UTF8
Write-Host "  تم إنشاء ProjectSettings" -ForegroundColor Green

# --- الخطوة 6: تحميل ONNX Runtime ---
Write-Host "[6/7] تحميل ONNX Runtime..." -ForegroundColor Yellow

$onnxUrl = "https://www.nuget.org/api/v2/package/Microsoft.ML.OnnxRuntime/1.16.3"
$onnxZip = "$env:TEMP\onnxruntime.zip"
$onnxExtract = "$env:TEMP\onnxruntime"

try {
    if (!(Test-Path (Join-Path $ProjectPath "Assets\Plugins\OnnxRuntime"))) {
        Write-Host "  جاري تحميل Microsoft.ML.OnnxRuntime 1.16.3..." -ForegroundColor White
        Invoke-WebRequest -Uri $onnxUrl -OutFile $onnxZip -ErrorAction Stop

        if (Test-Path $onnxExtract) { Remove-Item $onnxExtract -Recurse -Force }
        Expand-Archive -Path $onnxZip -DestinationPath $onnxExtract -Force

        $pluginDir = Join-Path $ProjectPath "Assets\Plugins\OnnxRuntime"
        New-Item -ItemType Directory -Path $pluginDir -Force | Out-Null

        $dllSource = Get-ChildItem $onnxExtract -Recurse -Filter "Microsoft.ML.OnnxRuntime.dll" | Select-Object -First 1
        if ($dllSource) {
            Copy-Item $dllSource.FullName -Destination $pluginDir
            Write-Host "  تم نسخ ONNX Runtime DLL" -ForegroundColor Green
        }

        $nativeSource = Join-Path $onnxExtract "runtimes\android\native"
        if (Test-Path $nativeSource) {
            $androidPluginDir = Join-Path $ProjectPath "Assets\Plugins\Android"
            New-Item -ItemType Directory -Path $androidPluginDir -Force | Out-Null
            Copy-Item "$nativeSource\*" -Destination $androidPluginDir -Recurse
            Write-Host "  تم نسخ مكتبات Android الأصلية" -ForegroundColor Green
        }

        Remove-Item $onnxZip -Force -ErrorAction SilentlyContinue
        Remove-Item $onnxExtract -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "  ONNX Runtime موجود مسبقاً" -ForegroundColor Green
    }
} catch {
    Write-Host "  تعذر تحميل ONNX Runtime تلقائياً. يرجى تحميله يدوياً:" -ForegroundColor Red
    Write-Host "  https://www.nuget.org/packages/Microsoft.ML.OnnxRuntime/1.16.3" -ForegroundColor White
    Write-Host "  واستخراج الـ DLL إلى: Assets\Plugins\OnnxRuntime\" -ForegroundColor White
}

# --- الخطوة 7: رسالة ختامية ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  تم تجهيز هيكل المشروع بنجاح!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "الخطوات التالية:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. انسخ ملفات المشروع من Replit:" -ForegroundColor White
Write-Host "     - حمّل المشروع كـ ZIP من Replit" -ForegroundColor Gray
Write-Host "     - انسخ مجلد Assets\ و Docs\ إلى:" -ForegroundColor Gray
Write-Host "       $ProjectPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. حمّل نموذج YOLO:" -ForegroundColor White
Write-Host "     - حمّل yolov8n.onnx من:" -ForegroundColor Gray
Write-Host "       https://github.com/ultralytics/assets/releases" -ForegroundColor Yellow
Write-Host "     - ضعه في: $ProjectPath\Assets\StreamingAssets\Models\" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. افتح المشروع في Unity:" -ForegroundColor White
Write-Host "     افتح Unity Hub > Open > اختر مجلد المشروع" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. صل جوال Android بكابل USB وفعّل تصحيح USB" -ForegroundColor White
Write-Host ""
Write-Host "  5. من Unity: File > Build and Run" -ForegroundColor White
Write-Host ""

$openProject = Read-Host "هل تريد فتح المشروع في Unity الآن؟ (y/n)"
if ($openProject -eq 'y') {
    if (Test-Path $unityExe) {
        Write-Host "جاري فتح Unity..." -ForegroundColor Cyan
        Start-Process $unityExe -ArgumentList "-projectPath `"$ProjectPath`""
    } else {
        Write-Host "لم يتم العثور على Unity. افتح المشروع يدوياً من Unity Hub." -ForegroundColor Yellow
    }
}
