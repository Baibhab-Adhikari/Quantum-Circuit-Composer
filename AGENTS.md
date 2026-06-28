# AGENTS.md

# Quantum Circuit Composer

## Project Goal

This project aims to build a modern, educational Quantum Circuit Composer inspired by IBM Quantum Composer.

The goal is **not** to clone IBM's application, but to create a clean, modular and extensible quantum circuit editor that can eventually support simulation, transpilation, and custom execution backends.

The project should be developed incrementally, with each milestone building upon a stable architectural foundation.

---

# Current Scope

Implement only the functionality required by the current milestone.

Do **not** implement future features unless they are explicitly requested.

Avoid speculative development and unnecessary abstractions.

---

# Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* dnd-kit
* Zustand

## Backend

* Python
* FastAPI
* Pydantic
* Qiskit
* AerSimulator

### Python Package Management

Always use **UV (Astral)** for Python environment and dependency management.

Do **not** use traditional `pip` workflows unless explicitly instructed.

Prefer:

* `uv init`
* `uv add`
* `uv sync`
* `uv run`

Follow modern UV project conventions whenever possible.

---

# Core Design Philosophy

The editor is fundamentally a **grid editor**.

Rows represent qubits.

Columns represent timesteps.

Never think in terms of arbitrary pixel positions.

Internally everything should be represented using:

(row, column)

coordinates.

---

# Circuit Model

The Circuit Model is the single source of truth.

The UI must always render from the Circuit Model.

Never use rendered UI state as application state.

The Circuit Model is responsible for:

* qubits
* classical bits
* operations
* gate placement
* selection
* placement session

All rendering should derive from the Circuit Model.

---

# Supported Gates

Current gates:

* H
* X
* Y
* Z
* S
* T
* CX
* CCX
* Measure

No parameterized gates yet.

---

# Circuit Rules

Maintain logical correctness.

Rules include:

* One gate per grid cell.
* Gates cannot overlap.
* Single-qubit gates occupy one cell.
* Multi-qubit gates occupy multiple rows within the same column.
* Gates snap to the nearest valid grid position.
* Prevent invalid placements whenever possible.
* Keep validation centralized instead of scattering it across UI components.

---

# Architecture Principles

* The Circuit Model is the single source of truth.
* Business logic should remain separate from presentation.
* Rendering components should remain lightweight.
* Serialization and execution should live outside the UI layer.
* Future execution backends should be replaceable without modifying the frontend.

---

# Code Quality

Always prefer:

* Readable code
* Modular components
* Strong TypeScript typing
* Small reusable components
* Immutable state updates
* Separation of concerns

Avoid:

* Premature optimization
* Unnecessary abstractions
* Code duplication
* Tight coupling between frontend and backend

---

# Component Structure

Suggested hierarchy:

App

├── Toolbar

├── GatePalette

├── CircuitEditor

│   ├── CircuitGrid

│   ├── QubitWire

│   ├── Gate

│   └── SelectionLayer

├── AnalysisPanel

└── StatusBar

This structure may evolve as the application grows.

---

# Development Workflow

Implement only one milestone at a time.

Before writing code:

1. Analyze the existing repository.
2. Explain the implementation plan.
3. List the files to be modified or created.
4. Wait for approval before making changes.

Do not modify unrelated code.

Reuse existing architecture wherever possible.

---

# General Principle

Whenever there is uncertainty:

Prefer simplicity.

A clean, maintainable, and extensible implementation is always better than a clever but overly complex one.

Whenever implementing new functionality, consult the official documentation of the relevant technologies (React, Next.js, FastAPI, Pydantic, Qiskit, etc.) and follow current best practices rather than relying on assumptions.
