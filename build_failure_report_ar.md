# تقرير تحليل فشل بناء تطبيق NomadGo SpatialVision

بعد مراجعة المستودع (Repository) وتحليل ملفات المشروع وعملية البناء (CI/CD)، تم تحديد الأسباب التفصيلية والمحددة التي أدت إلى فشل بناء التطبيق، وهي تتركز في ثلاثة محاور رئيسية:

## 1. أخطاء برمجية في كود Unity (C# Compilation Errors)
يحتوي ملف `Assets/Scripts/Vision/ONNXInferenceEngine.cs` على أخطاء برمجية تمنع عملية الـ Compilation بنجاح، وهي:
*   **استخدام غير صحيح لـ Unity Sentis API:** الكود مكتوب بأسلوب مكتبة "Barracuda" القديمة أو إصدارات تجريبية سابقة، حيث يتم استخدام `output[0, 0, i]` للوصول إلى بيانات الـ Tensor. في إصدار Sentis 1.3.0 المستخدم في المشروع، لا يدعم الـ `TensorFloat` الوصول المباشر عبر الـ Indexer ثلاثي الأبعاد، ويجب تحميل البيانات من الـ GPU أولاً باستخدام `CompleteOperationsAndDownload()` ثم الوصول إليها كـ `ReadOnlySpan` أو `NativeArray`.
*   **ترتيب غير صحيح للمعاملات (Arguments Order):** في السطر الخاص بإنشاء الـ Worker:
    `worker = WorkerFactory.CreateWorker(BackendType.CPU, runtimeModel);`
    الترتيب الصحيح في Sentis 1.3.0 هو `(runtimeModel, BackendType.CPU)`. هذا الخطأ سيؤدي لفشل البناء فوراً.
*   **محاولة إنشاء Tensor بشكل غير مدعوم:** يتم استخدام `new TensorFloat(shape, data)` حيث `data` هي `float[]`. في الإصدارات الحديثة من Sentis، يتوقع المنشئ (Constructor) غالباً `ReadOnlySpan<float>` أو `NativeArray`.

## 2. ملفات مفقودة وأصول ناقصة (Missing Assets)
*   **فقدان ملفات التعريف (.meta files):** المستودع يخلو تماماً من ملفات الـ `.meta` الخاصة بـ Unity. هذه الملفات ضرورية لربط الأصول (Assets) ببعضها عبر المعرفات الفريدة (GUIDs). عند محاولة البناء، سيقوم Unity بتوليد GUIDs جديدة، مما سيؤدي لكسر الروابط في `EditorBuildSettings.asset` والمشاهد (Scenes)، وبالتالي فشل العثور على المشهد الرئيسي `Main.unity` أثناء البناء.
*   **فقدان نموذج الذكاء الاصطناعي:** ملف النموذج `yolov8n.onnx` غير موجود في المسار المحدد `Assets/Models/`. بالرغم من أن فقدان أصل قد لا يكسر الـ Compilation دائماً، إلا أن الكود يعتمد عليه بشكل أساسي، وإذا كانت هناك خطوات بناء مخصصة تتحقق من وجوده فستفشل.
*   **خطأ في مسارات الـ Resources:** الكود يستخدم `Resources.Load` لتحميل النموذج والملصقات (Labels)، لكن هذه الملفات موجودة في `Assets/Models/` وليس داخل مجلد باسم `Resources`. في Unity، أي أصل يتم تحميله عبر `Resources.Load` **يجب** أن يكون داخل مجلد يسمى `Resources`.

## 3. تعارض في الإعدادات والتوثيق (Configuration Discrepancies)
*   **الخلط بين Sentis و ONNX Runtime:** ملف `Docs/RUNBOOK.md` يوجه المستخدم لتثبيت `ONNX Runtime for Unity` من Microsoft، بينما الكود الفعلي وملف `Packages/manifest.json` يستخدمان مكتبة `Unity Sentis`. هذا التعارض يؤدي إلى فشل المطورين في إعداد البيئة الصحيحة للبناء.
*   **تبعية مفقودة في Node.js:** بالرغم من نجاح البناء المحلي للـ Node.js بعد تثبيت المكتبات، إلا أن مكتبة `nanoid` مستخدمة في `server/vite.ts` ولكنها غير مدرجة في قسم `dependencies` في `package.json` (موجودة فقط كـ transitive dependency)، مما قد يسبب مشاكل في بيئات البناء التي تستخدم `npm install --production`.

## 4. مشاكل في إعدادات الـ CI/CD (GitHub Actions)
*   **أسرار الترخيص (Unity License Secrets):** يعتمد ملف `build-android.yml` على وجود أسرار (Secrets) مثل `UNITY_LICENSE`. إذا لم يتم ضبط هذه الأسرار في إعدادات المستودع على GitHub، ستفشل عملية البناء في مرحلة التحقق الأولي (Preflight).

### التوصيات للإصلاح:
1. تصحيح كود `ONNXInferenceEngine.cs` ليتوافق مع Sentis 1.3.0 API.
2. إضافة ملفات `.meta` المفقودة للمستودع.
3. نقل ملفات النماذج إلى مجلد `Assets/Resources/Models/`.
4. توحيد التوثيق ليعتمد على Sentis بدلاً من ONNX Runtime.
5. إضافة `nanoid` بشكل صريح إلى `package.json`.
