# Quantum Circuit Composer

A modern, educational, and highly interactive Quantum Circuit Composer built with a React/Next.js frontend and a FastAPI/Qiskit backend. Inspired by IBM Quantum Composer, this project provides a clean, modular, and extensible platform for designing and simulating quantum circuits.

## Features

- **Visual Grid Editor**: An intuitive drag-and-drop interface for constructing quantum circuits on a grid.
- **Comprehensive Gate Support**: 
  - Standard single-qubit gates: $H$, $X$, $Y$, $Z$, $S$, $T$
  - Multi-qubit gates: $CX$ (CNOT), $CCX$ (Toffoli)
  - Parameterized rotations: $R_x(\theta)$, $R_y(\theta)$, $R_z(\theta)$ with smart fraction/radian formatting
  - Custom Unitary gates ($U$): Input arbitrary $2 \times 2$ matrices with unitarity validation
  - Measurement operations
- **ZYZ Euler Decomposition**: Automatically decompose arbitrary $2 \times 2$ unitary matrices into mathematically equivalent (up to global phase) $R_z \to R_y \to R_z$ sequences.
- **Statevector Simulation**: Execute circuits on the backend using IBM's Qiskit AerSimulator to generate statevectors, Dirac notation, OpenQASM, and measurement counts.
- **Robust State Management**: Implements undo/redo history, responsive interactions, and collision detection.

## Architecture

The application strictly separates presentation (frontend) from quantum execution logic (backend).

### Frontend Stack
- **Framework**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Interactions**: dnd-kit (drag-and-drop)
- **State Management**: Zustand (Circuit Model is the single source of truth)

### Backend Stack
- **Framework**: Python, FastAPI
- **Quantum Engine**: Qiskit, AerSimulator
- **Validation**: Pydantic
- **Package Manager**: UV (Astral)

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [UV](https://github.com/astral-sh/uv) 
- Python 3.10+

### Frontend Setup

1. Navigate to the project root directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Backend Setup

1. Navigate to the `backend` directory.
2. Create and sync the virtual environment using UV:
   ```bash
   uv sync
   ```
3. Run the FastAPI development server:
   ```bash
   uv run fastapi dev app/main.py
   ```
   *The backend will be available at [http://localhost:8000](http://localhost:8000).*

## Testing

The backend includes a comprehensive pytest suite covering API endpoints, Qiskit integration, decomposition logic, and statevector equivalence testing.

To run the backend tests:
```bash
cd backend
uv run pytest
```

## Core Design Philosophy

- **Circuit Model First**: The frontend UI always renders from a centralized, grid-based Circuit Model state `(row, column)`. We avoid deriving state from the DOM.
- **Mathematical Correctness**: We adhere to standard quantum mechanics conventions. Features like the Euler Decomposer preserve exact global phase (verifiable in backend logs) and format angles mathematically (e.g., $3\pi/4$).
- **Extensibility**: The architecture is designed so that future simulation or transpilation execution backends can be swapped in without fundamentally altering the frontend grid editor.

## License

This project is licensed under the MIT License.
