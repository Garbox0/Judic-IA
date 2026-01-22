"use client";
import { useEffect, useRef, useState } from "react";

export default function TetrisLoader() {
    const gameControls = useRef({});
    const canvasRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isGameOver, setIsGameOver] = useState(false);
    const [score, setScore] = useState(0);

    // Game Logic
    useEffect(() => {
        if (!isPlaying || isGameOver) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const grid = 24;
        const tetrominoSequence = [];
        const playfield = [];

        // Populate empty state
        for (let row = -2; row < 20; row++) {
            playfield[row] = [];
            for (let col = 0; col < 10; col++) {
                playfield[row][col] = 0;
            }
        }

        const tetrominos = {
            I: [
                [0, 0, 0, 0],
                [1, 1, 1, 1],
                [0, 0, 0, 0],
                [0, 0, 0, 0],
            ],
            J: [
                [1, 0, 0],
                [1, 1, 1],
                [0, 0, 0],
            ],
            L: [
                [0, 0, 1],
                [1, 1, 1],
                [0, 0, 0],
            ],
            O: [
                [1, 1],
                [1, 1],
            ],
            S: [
                [0, 1, 1],
                [1, 1, 0],
                [0, 0, 0],
            ],
            Z: [
                [1, 1, 0],
                [0, 1, 1],
                [0, 0, 0],
            ],
            T: [
                [0, 1, 0],
                [1, 1, 1],
                [0, 0, 0],
            ],
        };

        const colors = {
            I: "#22d3ee", // teal
            O: "#d4b24c", // gold
            T: "#a78bfa", // soft violet
            S: "#34d399", // emerald
            Z: "#fb7185", // rose
            J: "#60a5fa", // blue
            L: "#fbbf24", // amber
        };

        let count = 0;
        let tetromino = getNextTetromino();
        let rAF = null;

        function getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        function generateSequence() {
            const sequence = ["I", "J", "L", "O", "S", "T", "Z"];
            while (sequence.length) {
                const rand = getRandomInt(0, sequence.length - 1);
                const name = sequence.splice(rand, 1)[0];
                tetrominoSequence.push(name);
            }
        }

        function getNextTetromino() {
            if (tetrominoSequence.length === 0) generateSequence();
            const name = tetrominoSequence.pop();
            const matrix = tetrominos[name];
            const col =
                playfield[0].length / 2 - Math.ceil(matrix[0].length / 2);
            const row = name === "I" ? -1 : -2;
            return { name, matrix, row, col };
        }

        function rotate(matrix) {
            const N = matrix.length - 1;
            return matrix.map((row, i) => row.map((val, j) => matrix[N - j][i]));
        }

        function isValidMove(matrix, cellRow, cellCol) {
            for (let row = 0; row < matrix.length; row++) {
                for (let col = 0; col < matrix[row].length; col++) {
                    if (
                        matrix[row][col] &&
                        (cellCol + col < 0 ||
                            cellCol + col >= playfield[0].length ||
                            cellRow + row >= playfield.length ||
                            (playfield[cellRow + row] &&
                                playfield[cellRow + row][cellCol + col]))
                    ) {
                        return false;
                    }
                }
            }
            return true;
        }

        // --- NEW HELPERS FOR VISUAL GUIDE ---
        function getMatrixOccupiedColBounds(matrix) {
            let min = Infinity;
            let max = -Infinity;

            for (let r = 0; r < matrix.length; r++) {
                for (let c = 0; c < matrix[r].length; c++) {
                    if (matrix[r][c]) {
                        if (c < min) min = c;
                        if (c > max) max = c;
                    }
                }
            }
            return min === Infinity ? { min: 0, max: matrix[0].length - 1 } : { min, max };
        }

        function getHorizontalOriginLimits(matrix, row, startCol) {
            let minCol = startCol;
            while (isValidMove(matrix, row, minCol - 1)) minCol--;

            let maxCol = startCol;
            while (isValidMove(matrix, row, maxCol + 1)) maxCol++;

            return { minCol, maxCol };
        }

        function drawHorizontalMoveGuide(ctx, activeTetromino) {
            if (!activeTetromino) return;

            const { matrix, row, col } = activeTetromino;
            const occ = getMatrixOccupiedColBounds(matrix);
            const lim = getHorizontalOriginLimits(matrix, row, col);

            const leftCell = lim.minCol + occ.min;
            const rightCellExclusive = lim.maxCol + occ.max + 1;

            const y0 = Math.max(row, 0) * grid;
            const pieceH = matrix.length * grid;
            const h = Math.min(pieceH, canvas.height - y0);

            const x0 = leftCell * grid;
            const w = rightCellExclusive * grid - x0;

            ctx.save();
            ctx.fillStyle = "rgba(212,178,76,0.08)";
            ctx.strokeStyle = "rgba(212,178,76,0.55)";
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);

            ctx.fillRect(x0, y0, w, h);
            ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);

            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(212,178,76,0.20)";
            ctx.fillRect(x0, y0, 2, h);
            ctx.fillRect(x0 + w - 2, y0, 2, h);

            ctx.restore();
        }
        // ------------------------------------

        function placeTetromino() {
            for (let row = 0; row < tetromino.matrix.length; row++) {
                for (let col = 0; col < tetromino.matrix[row].length; col++) {
                    if (tetromino.matrix[row][col]) {
                        if (tetromino.row + row < 0) {
                            cancelAnimationFrame(rAF);
                            setIsGameOver(true);
                            return;
                        }
                        playfield[tetromino.row + row][tetromino.col + col] =
                            tetromino.name;
                    }
                }
            }

            let linesCleared = 0;
            for (let row = playfield.length - 1; row >= 0;) {
                if (playfield[row].every((cell) => !!cell)) {
                    linesCleared++;
                    for (let r = row; r >= 0; r--) {
                        for (let c = 0; c < playfield[r].length; c++) {
                            playfield[r][c] = playfield[r - 1][c];
                        }
                    }
                } else {
                    row--;
                }
            }

            if (linesCleared > 0) {
                setScore((prev) => prev + linesCleared * 100);
            }

            tetromino = getNextTetromino();
        }

        function loop() {
            rAF = requestAnimationFrame(loop);

            // Deep Navy Background
            context.fillStyle = "rgba(2, 6, 23, 1)";
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Playfield
            for (let row = 0; row < 20; row++) {
                for (let col = 0; col < 10; col++) {
                    if (playfield[row][col]) {
                        const name = playfield[row][col];
                        context.fillStyle = colors[name];
                        context.fillRect(col * grid, row * grid, grid - 1, grid - 1);
                    }
                }
            }

            if (tetromino) {
                if (++count > 25) {
                    tetromino.row++;
                    count = 0;
                    if (!isValidMove(tetromino.matrix, tetromino.row, tetromino.col)) {
                        tetromino.row--;
                        placeTetromino();
                    }
                }

                // DRAW GUIDE BEFORE PIECE
                drawHorizontalMoveGuide(context, tetromino);

                context.fillStyle = colors[tetromino.name];
                for (let row = 0; row < tetromino.matrix.length; row++) {
                    for (let col = 0; col < tetromino.matrix[row].length; col++) {
                        if (tetromino.matrix[row][col]) {
                            context.fillRect(
                                (tetromino.col + col) * grid,
                                (tetromino.row + row) * grid,
                                grid - 1,
                                grid - 1
                            );
                        }
                    }
                }
            }
        }

        // --- CONTROLS LOGIC EXPOSED ---
        const move = (dir) => {
            if (!tetromino) return;
            const col = dir === 'left' ? tetromino.col - 1 : tetromino.col + 1;
            if (isValidMove(tetromino.matrix, tetromino.row, col))
                tetromino.col = col;
        };

        const doRotate = () => {
            if (!tetromino) return;
            const matrix = rotate(tetromino.matrix);
            if (isValidMove(matrix, tetromino.row, tetromino.col))
                tetromino.matrix = matrix;
        };

        const drop = () => {
            if (!tetromino) return;
            const row = tetromino.row + 1;
            if (!isValidMove(tetromino.matrix, row, tetromino.col)) {
                tetromino.row = row - 1;
                placeTetromino();
                return;
            }
            tetromino.row = row;
        }

        // Expose to ref for UI buttons
        gameControls.current = {
            left: () => move('left'),
            right: () => move('right'),
            rotate: doRotate,
            drop: drop
        };

        // Input Handling
        const handleKeydown = (e) => {
            if ([37, 38, 39, 40].includes(e.which)) {
                e.preventDefault();
            }

            if (isGameOver || !isPlaying) return;

            if (e.which === 37) move('left');
            if (e.which === 39) move('right');
            if (e.which === 38) doRotate();
            if (e.which === 40) drop();
        };

        document.addEventListener("keydown", handleKeydown);
        rAF = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(rAF);
            document.removeEventListener("keydown", handleKeydown);
        };
    }, [isPlaying, isGameOver]);

    const handleRestart = () => {
        setScore(0);
        setIsGameOver(false);
    };

    return (
        <div className="tetris-loader w-full max-w-[520px] mx-auto flex flex-col items-center justify-center gap-2 p-4 sm:p-6 bg-slate-900/90 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl transition-all duration-500">
            {/* Header Copy Block */}
            <div className="ji-loaderCopy flex flex-col items-center text-center">
                <span className="ji-eyebrow">JURISPRUDENCIA • FUENTES OFICIALES</span>
                <h3 className="ji-title">Motor verificado en ejecución</h3>
                <p className="ji-subtitle">Cruce de fallos y doctrina con enlaces auditables (AR)</p>

                <p className="text-gray-300 mt-4 mb-3 text-sm leading-relaxed">
                    Búsqueda profunda activa...
                </p>

                {!isPlaying && !isGameOver && (
                    <button onClick={() => setIsPlaying(true)} className="ji-cta">
                        <span>👾</span> Modo pausa: Tetris
                    </button>
                )}
            </div>

            {/* Bloque centrado como unidad: verificación + juego + controles */}
            <div className="w-full flex flex-col items-center">
                {/** ancho fijo del bloque (mismo para verificación/juego/controles) */}
                {(() => {
                    const gameW = "w-[220px] sm:w-[240px] md:w-[260px]";

                    return (
                        <>
                            {/* Verificación centrada EXACTA (misma “columna” que el juego) */}
                            {isPlaying && !isGameOver && (
                                <div className={`${gameW} flex justify-center mt-2 mb-3`}>
                                    <div className="ji-pill self-center">
                                        Verificación: <strong>{Math.floor(score / 100)}/10</strong>
                                    </div>
                                </div>
                            )}

                            {/* Juego */}
                            <div
                                className={`relative mx-auto rounded-xl overflow-hidden border-4 border-yellow-500/50 shadow-[0_0_40px_rgba(251,191,36,0.15)] bg-slate-950 group ${gameW} aspect-[1/2]`}
                            >
                                {/* GAME OVER SCREEN */}
                                {isGameOver && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 p-6 text-center animate-fadeIn backdrop-blur-sm">
                                        <h4 className="text-3xl font-black text-red-500 mb-2 ji-title">GAME OVER</h4>
                                        <div className="ji-pill mb-3">
                                            Nivel: <strong>{Math.floor(score / 100)}/10</strong>
                                        </div>
                                        <p className="ji-subtitle mb-3 pt-4">
                                            El sistema sigue buscando tu jurisprudencia...
                                        </p>
                                        <button onClick={handleRestart} className="ji-cta">
                                            <span>🔄</span> Reintentar
                                        </button>
                                    </div>
                                )}

                                <canvas
                                    ref={canvasRef}
                                    width={240}
                                    height={480}
                                    className="block w-full h-full object-contain opacity-90"
                                />

                                {/* CRT Scanline Effect Overlay */}
                                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[5] bg-[length:100%_2px,3px_100%]"></div>
                            </div>

                            {/* Controles para Desktop */}
                            <div
                                className={`ji-controlsHint ${gameW} hidden md:flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center mt-3 text-xs sm:text-sm`}
                            >
                                <span>← → mover</span>
                                <span className="text-slate-600">•</span>
                                <span>↑ rotar</span>
                                <span className="text-slate-600">•</span>
                                <span>↓ acelerar</span>
                            </div>

                            {/* TOUCH CONTROLS FOR MOBILE (Visible only on md or smaller) */}
                            {isPlaying && !isGameOver && (
                                <div className={`${gameW} md:hidden flex flex-col gap-2 mt-4`}>
                                    <div className="flex justify-center gap-4">
                                        <button
                                            className="w-16 h-14 bg-slate-800 rounded-lg border border-slate-700 active:bg-yellow-500/20 active:border-yellow-500 transition-colors flex items-center justify-center text-xl"
                                            onClick={() => gameControls.current.left && gameControls.current.left()}
                                        >
                                            ⬅️
                                        </button>

                                        <div className="flex flex-col gap-2">
                                            <button
                                                className="w-16 h-14 bg-slate-800 rounded-lg border border-slate-700 active:bg-yellow-500/20 active:border-yellow-500 transition-colors flex items-center justify-center text-xl"
                                                onClick={() => gameControls.current.rotate && gameControls.current.rotate()}
                                            >
                                                🔄
                                            </button>
                                            <button
                                                className="w-16 h-14 bg-slate-800 rounded-lg border border-slate-700 active:bg-yellow-500/20 active:border-yellow-500 transition-colors flex items-center justify-center text-xl"
                                                onClick={() => gameControls.current.drop && gameControls.current.drop()}
                                            >
                                                ⬇️
                                            </button>
                                        </div>

                                        <button
                                            className="w-16 h-14 bg-slate-800 rounded-lg border border-slate-700 active:bg-yellow-500/20 active:border-yellow-500 transition-colors flex items-center justify-center text-xl"
                                            onClick={() => gameControls.current.right && gameControls.current.right()}
                                        >
                                            ➡️
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>
        </div>
    );
}



