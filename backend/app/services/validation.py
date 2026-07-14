from typing import List, Tuple
import numpy as np
from app.schemas.circuit import ComplexNumberSchema

def to_numpy_matrix(matrix: List[List[ComplexNumberSchema]]) -> np.ndarray:
    """Converts a schema matrix to a numpy complex array."""
    return np.array([[complex(c.real, c.imag) for c in row] for row in matrix], dtype=complex)

def validate_complex_matrix(matrix: List[List[ComplexNumberSchema]]) -> Tuple[bool, str]:
    """Validates that a matrix is a 2x2 grid."""
    if len(matrix) != 2:
        return False, "Matrix must have exactly 2 rows."
    for row in matrix:
        if len(row) != 2:
            return False, "Matrix must have exactly 2 columns."
    return True, ""

def validate_unitarity(matrix: List[List[ComplexNumberSchema]], tolerance: float = 1e-4) -> Tuple[bool, str]:
    """Validates that a 2x2 matrix is unitary (U†U ≈ I)."""
    valid_dim, msg = validate_complex_matrix(matrix)
    if not valid_dim:
        return False, msg
        
    np_mat = to_numpy_matrix(matrix)
    
    # Compute U† U
    u_dag = np_mat.conj().T
    product = u_dag @ np_mat
    
    # Check if close to identity
    identity = np.eye(2, dtype=complex)
    if not np.allclose(product, identity, atol=tolerance):
        return False, "Matrix is not unitary (U†U ≠ I)."
        
    return True, ""
