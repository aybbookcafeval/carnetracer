import React, { useRef, useState, useCallback } from "react";
import { Camera, RefreshCw, Check, Upload } from "lucide-react";
import { cn } from "../lib/utils";

interface CameraCaptureProps {
  onCapture: (image: string) => void;
  isAdmin?: boolean;
  className?: string;
}

export function CameraCapture({ onCapture, isAdmin = false, className }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setError(null);
    try {
<<<<<<< HEAD
      // Try environment camera first (back camera on mobile), requesting high resolution
=======
      // Try environment camera first (back camera on mobile)
>>>>>>> 6d218d4ce3a6b85bc86a362215731f6ff4eaf61f
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "environment",
<<<<<<< HEAD
            width:  { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            aspectRatio: { ideal: 16/9 },
=======
            aspectRatio: { ideal: 9/16 }
>>>>>>> 6d218d4ce3a6b85bc86a362215731f6ff4eaf61f
          } 
        });
      } catch (err) {
        console.warn("Environment camera not found, falling back to default video device.");
<<<<<<< HEAD
        // Fallback to any camera, still requesting decent resolution
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width:  { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          }
=======
        // Fallback to any camera
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { aspectRatio: { ideal: 9/16 } } 
>>>>>>> 6d218d4ce3a6b85bc86a362215731f6ff4eaf61f
        });
      }

      streamRef.current = stream;
      setIsStreaming(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("No se pudo acceder a la cámara. Intente subir un archivo.");
    }
  };

  // Effect to attach stream to video element when it becomes available
  React.useEffect(() => {
    if (isStreaming && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isStreaming]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current) {
            const context = canvasRef.current.getContext("2d");
            if (context) {
<<<<<<< HEAD
              // Keep up to 1920px — enough for AI analysis without excessive file size
              const maxWidth = 1920;
              const scale = Math.min(1, maxWidth / img.width);
              canvasRef.current.width = img.width * scale;
              canvasRef.current.height = img.height * scale;
              context.imageSmoothingEnabled = true;
              context.imageSmoothingQuality = "high";
              context.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
              const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.88);
=======
              const maxWidth = 640;
              const scale = Math.min(1, maxWidth / img.width);
              canvasRef.current.width = img.width * scale;
              canvasRef.current.height = img.height * scale;
              context.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
              const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.6);
>>>>>>> 6d218d4ce3a6b85bc86a362215731f6ff4eaf61f
              setCapturedImage(dataUrl);
              onCapture(dataUrl);
            }
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const capture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
<<<<<<< HEAD
        // Capture at native resolution up to 1920px — preserves detail for AI analysis
        const maxWidth = 1920;
        const scale = Math.min(1, maxWidth / videoRef.current.videoWidth);
        canvasRef.current.width = videoRef.current.videoWidth * scale;
        canvasRef.current.height = videoRef.current.videoHeight * scale;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        // High-quality JPEG — balance between sharpness and upload size
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.88);
        setCapturedImage(dataUrl);
        onCapture(dataUrl);

=======
        // Downscale for storage (max 640px width)
        const maxWidth = 640;
        const scale = Math.min(1, maxWidth / videoRef.current.videoWidth);
        canvasRef.current.width = videoRef.current.videoWidth * scale;
        canvasRef.current.height = videoRef.current.videoHeight * scale;
        
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        // Use lower quality JPEG to save space
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.6);
        setCapturedImage(dataUrl);
        onCapture(dataUrl);
        
>>>>>>> 6d218d4ce3a6b85bc86a362215731f6ff4eaf61f
        // Stop stream
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setIsStreaming(false);
      }
    }
  }, [onCapture]);

  const reset = () => {
    setCapturedImage(null);
    setError(null);
    if (isStreaming) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsStreaming(false);
    }
  };

  return (
    <div className={cn("relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[350px] mx-auto flex items-center justify-center", className)}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileUpload}
      />

      {!isStreaming && !capturedImage && (
        <div className="flex flex-col items-center gap-6">
          <div className="flex gap-8">
            <button
              type="button"
              onClick={startCamera}
              className="flex flex-col items-center gap-2 text-white hover:text-blue-400 transition-colors"
            >
              <Camera className="w-12 h-12" />
              <span className="font-medium text-sm">Cámara</span>
            </button>
            
            {isAdmin && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 text-white hover:text-blue-400 transition-colors"
              >
                <Upload className="w-12 h-12" />
                <span className="font-medium text-sm">Subir Archivo</span>
              </button>
            )}
          </div>
          
          {error && (
            <p className="text-brand text-xs font-medium px-4 text-center">{error}</p>
          )}
        </div>
      )}

      {isStreaming && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={capture}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-white bg-black hover:bg-slate-800 transition-all active:scale-90"
          />
        </>
      )}

      {capturedImage && (
        <div className="relative w-full h-full">
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-green-500 text-white p-2 rounded-full">
              <Check className="w-8 h-8" />
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="absolute top-2 right-2 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
