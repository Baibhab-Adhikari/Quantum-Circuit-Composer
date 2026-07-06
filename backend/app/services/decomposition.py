from typing import List
import numpy as np
from qiskit.synthesis import OneQubitEulerDecomposer
from app.schemas.circuit import DecomposedGateSchema, ComplexNumberSchema
from app.services.validation import to_numpy_matrix
import logging

logger = logging.getLogger(__name__)

def format_angle(radians: float) -> str:
    """Formats an angle in radians into a readable quantum string."""
    if abs(radians) < 1e-5:
        return "0"
    
    pi_ratio = radians / np.pi
    
    # Check integers
    if abs(round(pi_ratio) - pi_ratio) < 1e-5:
        n = round(pi_ratio)
        if n == 1: return "π"
        if n == -1: return "-π"
        return f"{n}π"
        
    # Check denominators up to 8
    for den in [2, 3, 4, 6, 8]:
        num = round(pi_ratio * den)
        if abs(num / den - pi_ratio) < 1e-5:
            if num == 1: return f"π/{den}"
            if num == -1: return f"-π/{den}"
            return f"{num}π/{den}"
            
    return f"{radians:.3f} rad"

class DecompositionService:
    def __init__(self):
        # We use ZYZ decomposition as requested
        self.decomposer = OneQubitEulerDecomposer(basis='ZYZ')
        
    def decompose_unitary(self, matrix: List[List[ComplexNumberSchema]], start_column: int) -> List[DecomposedGateSchema]:
        """
        Decomposes a 2x2 unitary matrix into a sequence of Rz -> Ry -> Rz gates.
        Returns the new gates with incrementing column positions starting at `start_column`.
        """
        np_mat = to_numpy_matrix(matrix)
        
        try:
            # angles_and_phase returns [theta, phi, lambda, phase]
            # representing U = e^(i*phase) * Rz(phi) * Ry(theta) * Rz(lambda)
            # The applied sequence is Rz(lambda) -> Ry(theta) -> Rz(phi)
            theta, phi, lam, phase = self.decomposer.angles_and_phase(np_mat)
            
            logger.info(f"\nZYZ Euler Decomposition\nGlobal Phase : {format_angle(phase)}\nRz(phi)      : {format_angle(phi)}\nRy(theta)    : {format_angle(theta)}\nRz(lambda)   : {format_angle(lam)}")
            
            gates = []
            col = start_column
            
            # We return all three gates even if the angle is 0 to maintain consistent structure
            
            # 1. First Rz gate (lambda)
            gates.append(DecomposedGateSchema(
                type="Rz",
                params={"theta": lam},
                column=col
            ))
            
            # 2. Second Ry gate (theta)
            gates.append(DecomposedGateSchema(
                type="Ry",
                params={"theta": theta},
                column=col + 1
            ))
            
            # 3. Third Rz gate (phi)
            gates.append(DecomposedGateSchema(
                type="Rz",
                params={"theta": phi},
                column=col + 2
            ))
            
            return gates
            
        except Exception as e:
            logger.error(f"Decomposition failed: {e}")
            raise ValueError(f"Failed to decompose unitary matrix: {str(e)}")
