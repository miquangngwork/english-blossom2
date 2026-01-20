// public/_sdk/ai_camera.js

class AICamera {
    constructor(videoElementId, callback, options = {}) {
        this.video = document.getElementById(videoElementId);
        this.callback = callback;
        this.isModelLoaded = false;
        this.isRunning = false;
        this.interval = null;
        this.negativeStartAt = null;
        this.lastDominant = null;
        // Sensitivity knobs (can be overridden via options)
        this.MIN_CONFIDENCE = typeof options.minConfidence === 'number' ? options.minConfidence : 0.35;
        this.REQUIRED_DURATION = typeof options.requiredDurationMs === 'number' ? options.requiredDurationMs : 900;
        this.NEGATIVE_SUM_THRESHOLD = typeof options.negativeSumThreshold === 'number' ? options.negativeSumThreshold : 0.65;
        this.NEGATIVE_EMOTIONS = Array.isArray(options.negativeEmotions)
            ? options.negativeEmotions
            : ['sad', 'angry', 'fearful', 'disgusted', 'surprised'];
        this.COOLDOWN = false;
        this.COOLDOWN_MS = typeof options.cooldownMs === 'number' ? options.cooldownMs : 8000;
        this.DETECT_INTERVAL_MS = typeof options.detectIntervalMs === 'number' ? options.detectIntervalMs : 200;
        this.DETECTOR_INPUT_SIZE = typeof options.inputSize === 'number' ? options.inputSize : 224;
        this.DETECTOR_SCORE_THRESHOLD = typeof options.scoreThreshold === 'number' ? options.scoreThreshold : 0.35;
        this._boundPlay = null;
    }

    async loadModels() {
        // Đường dẫn này cực quan trọng, nó trỏ vào public/models
        const MODEL_URL = '/models'; 
        console.log("📷 [AI] Bắt đầu tải Model từ:", MODEL_URL);

        try {
            // Kiểm tra xem faceapi có tồn tại không
            if (typeof faceapi === 'undefined') {
                throw new Error("Chưa load thư viện face-api.min.js! Hãy kiểm tra thẻ <script>");
            }

            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            console.log("✅ [AI] Tải Model thành công!");
            this.isModelLoaded = true;
        } catch (e) {
            console.error("❌ [AI] Lỗi tải Model:", e);
            alert("Lỗi tải AI: " + e.message + "\n\n(Hãy F12 xem tab Network có bị 404 không)");
            throw e; // Ném lỗi để dừng hàm start()
        }
    }

    async start() {
        console.log("🚀 [AI] Đang khởi động Camera...");
        
        // 1. Tải model trước
        if (!this.isModelLoaded) {
            try {
                await this.loadModels();
            } catch (e) {
                return; // Dừng nếu lỗi model
            }
        }
        
        // 2. Xin quyền Camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            console.log("✅ [AI] Đã cấp quyền Camera!");
            
            this.video.srcObject = stream;
            this.isRunning = true;

            if (!this._boundPlay) {
                this._boundPlay = () => {
                    console.log("▶️ [AI] Video đang phát, bắt đầu quét...");
                    
                    // Tạo canvas ảo để tính toán kích thước
                    const canvas = faceapi.createCanvasFromMedia(this.video);
                    const displaySize = { width: this.video.width || 320, height: this.video.height || 240 };
                    faceapi.matchDimensions(canvas, displaySize);

                    if (this.interval) clearInterval(this.interval);
                    this.interval = setInterval(async () => {
                        if (this.COOLDOWN) return; 

                        try {
                            const detections = await faceapi.detectAllFaces(
                                this.video,
                                new faceapi.TinyFaceDetectorOptions({ inputSize: this.DETECTOR_INPUT_SIZE, scoreThreshold: this.DETECTOR_SCORE_THRESHOLD })
                            )
                                .withFaceExpressions();

                            if (detections.length > 0) {
                                const expressions = detections[0].expressions;
                                this.analyzeEmotion(expressions);
                            }
                        } catch (err) {
                            console.error("Lỗi quét mặt:", err);
                        }
                    }, this.DETECT_INTERVAL_MS); 
                };
                this.video.addEventListener('play', this._boundPlay);
            }
        } catch (err) {
            console.error("❌ [AI] Lỗi xin quyền Camera:", err);
            alert("Không thể mở Camera: " + err.message + "\nHãy kiểm tra biểu tượng ổ khóa trên thanh địa chỉ.");
        }
    }

    stop() {
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        clearInterval(this.interval);
        this.isRunning = false;
        this.resetStruggle();
        console.log("🛑 [AI] Đã tắt Camera.");
    }

    resetStruggle() {
        this.negativeStartAt = null;
        this.lastDominant = null;
    }

    analyzeEmotion(expressions) {
        const emotions = Object.keys(expressions);
        let maxScore = 0;
        let dominant = 'neutral';

        emotions.forEach(e => {
            if (expressions[e] > maxScore) {
                maxScore = expressions[e];
                dominant = e;
            }
        });

        let negativeSum = 0;
        for (const e of this.NEGATIVE_EMOTIONS) {
            if (typeof expressions[e] === 'number') negativeSum += expressions[e];
        }

        // Trigger struggling if either:
        // - dominant emotion is negative with enough confidence, OR
        // - total negative probability mass is high (helps with subtle/unstable expressions)
        const isNegative =
            (this.NEGATIVE_EMOTIONS.includes(dominant) && maxScore >= this.MIN_CONFIDENCE) ||
            (negativeSum >= this.NEGATIVE_SUM_THRESHOLD);

        if (isNegative) {
            const now = Date.now();
            // Don't reset timer just because dominant negative emotion changes.
            if (!this.negativeStartAt) this.negativeStartAt = now;
            this.lastDominant = dominant;
            if (now - this.negativeStartAt >= this.REQUIRED_DURATION) {
                this.callback('struggling', dominant, maxScore);
                this.resetStruggle();
                this.triggerCooldown();
            }
        } else {
            this.resetStruggle();
        }
    }

    triggerCooldown() {
        this.COOLDOWN = true;
        setTimeout(() => { this.COOLDOWN = false; }, this.COOLDOWN_MS);
    }
}