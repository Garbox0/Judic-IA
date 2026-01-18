import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import getCroppedImg from "./canvasUtils";

const AvatarEditor = ({ imageSrc, onCancel, onSave }) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [loading, setLoading] = useState(false);

    const onCropComplete = useCallback((_, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSave = async () => {
        setLoading(true);
        try {
            const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
            onSave(croppedImage);
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="editor-overlay" role="dialog" aria-modal="true">
            <div className="editor-container">
                <h3 className="editor-title">Ajustar Foto</h3>

                <div className="crop-container">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                </div>

                <div className="controls">
                    <div className="slider-container">
                        <span className="slider-label">Zoom</span>
                        <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-label="Zoom"
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="zoom-range"
                            disabled={loading}
                        />
                    </div>

                    <div className="button-row">
                        <button
                            className="ae-btn ae-btn-secondary"
                            disabled={loading}
                            onClick={onCancel}
                            type="button"
                        >
                            Cancelar
                        </button>

                        <button
                            className="ae-btn ae-btn-primary"
                            disabled={loading}
                            onClick={handleSave}
                            type="button"
                        >
                            {loading ? "Procesando..." : "Aplicar"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .editor-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(6px);
          padding: 16px;
        }

        .editor-container {
          background: radial-gradient(
              1200px 400px at 50% 0%,
              rgba(251, 191, 36, 0.08),
              transparent 55%
            ),
            #0f172a;
          width: 100%;
          max-width: 560px;
          border-radius: 22px;
          border: 1px solid rgba(251, 191, 36, 0.22);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
          padding: 20px;
        }

        .editor-title {
          color: #e5e7eb;
          text-align: center;
          font-weight: 800;
          letter-spacing: 0.02em;
          margin: 0 0 14px;
          font-size: 22px;
        }

        .crop-container {
          position: relative;
          width: 100%;
          height: clamp(240px, 42vh, 360px);
          background: #020617;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
          margin-bottom: 14px;
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .slider-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slider-label {
          color: #94a3b8;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .zoom-range {
          width: 100%;
          accent-color: #fbbf24;
          height: 4px;
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          appearance: none;
        }

        .zoom-range::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          background: #fbbf24;
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid rgba(2, 6, 23, 0.8);
          box-shadow: 0 8px 18px rgba(251, 191, 36, 0.28);
        }

        .button-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
        }

        /* Botones locales (NO dependen de estilos globales) */
        .ae-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 0 16px;
          border-radius: 14px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          transition: transform 0.12s ease, box-shadow 0.2s ease,
            background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
          user-select: none;
          white-space: nowrap;
        }

        .ae-btn:active {
          transform: translateY(1px);
        }

        .ae-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .ae-btn-primary {
          color: #0b1220;
          background: linear-gradient(180deg, #fbbf24, #f59e0b);
          border: 1px solid rgba(251, 191, 36, 0.32);
          box-shadow: 0 14px 30px rgba(245, 158, 11, 0.22);
        }

        .ae-btn-primary:hover:not(:disabled) {
          box-shadow: 0 18px 44px rgba(245, 158, 11, 0.3);
        }

        .ae-btn-secondary {
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .ae-btn-secondary:hover:not(:disabled) {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.06);
        }

        /* Mobile: botones apilados, full width */
        @media (max-width: 520px) {
          .editor-container {
            padding: 16px;
            border-radius: 18px;
          }

          .button-row {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .ae-btn {
            width: 100%;
          }
        }
      `}</style>
        </div>
    );
};

export default AvatarEditor;
