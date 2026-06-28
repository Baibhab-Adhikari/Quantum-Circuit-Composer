import pytest
import math
from app.serializers.dirac import DiracSerializer

@pytest.fixture
def dirac_serializer():
    return DiracSerializer()

def test_dirac_basis_states(dirac_serializer):
    assert dirac_serializer.serialize([1.0, 0.0], num_qubits=1) == "|0⟩"
    assert dirac_serializer.serialize([0.0, 1.0], num_qubits=1) == "|1⟩"
    assert dirac_serializer.serialize([0.0, 0.0, 0.0, 1.0], num_qubits=2) == "|11⟩"

def test_dirac_bell_state(dirac_serializer):
    inv_sqrt2 = 1 / math.sqrt(2)
    state = [inv_sqrt2, 0.0, 0.0, inv_sqrt2]
    assert dirac_serializer.serialize(state, num_qubits=2) == "(|00⟩ + |11⟩)/√2"

def test_dirac_superpositions(dirac_serializer):
    inv_sqrt2 = 1 / math.sqrt(2)
    # |+⟩
    assert dirac_serializer.serialize([inv_sqrt2, inv_sqrt2], num_qubits=1) == "(|0⟩ + |1⟩)/√2"
    # |-⟩
    assert dirac_serializer.serialize([inv_sqrt2, -inv_sqrt2], num_qubits=1) == "(|0⟩ - |1⟩)/√2"
    
def test_dirac_imaginary_phases(dirac_serializer):
    inv_sqrt2 = 1 / math.sqrt(2)
    # |0⟩ + i|1⟩
    assert dirac_serializer.serialize([inv_sqrt2, complex(0, inv_sqrt2)], num_qubits=1) == "(|0⟩ + i|1⟩)/√2"
    # |0⟩ - i|1⟩
    assert dirac_serializer.serialize([inv_sqrt2, complex(0, -inv_sqrt2)], num_qubits=1) == "(|0⟩ - i|1⟩)/√2"

def test_dirac_common_quantum_phases(dirac_serializer):
    inv_sqrt2 = 1 / math.sqrt(2)
    
    # e^(iπ/4)
    phase_pi_4 = complex(inv_sqrt2, inv_sqrt2) * inv_sqrt2
    assert dirac_serializer.serialize([inv_sqrt2, phase_pi_4], num_qubits=1) == "(|0⟩ + e^(iπ/4)|1⟩)/√2"
    
    # e^(-iπ/4)
    phase_neg_pi_4 = complex(inv_sqrt2, -inv_sqrt2) * inv_sqrt2
    assert dirac_serializer.serialize([inv_sqrt2, phase_neg_pi_4], num_qubits=1) == "(|0⟩ + e^(-iπ/4)|1⟩)/√2"
    
    # e^(i3π/4)
    phase_3pi_4 = complex(-inv_sqrt2, inv_sqrt2) * inv_sqrt2
    assert dirac_serializer.serialize([inv_sqrt2, phase_3pi_4], num_qubits=1) == "(|0⟩ + e^(i3π/4)|1⟩)/√2"
    
    # e^(-i3π/4)
    phase_neg_3pi_4 = complex(-inv_sqrt2, -inv_sqrt2) * inv_sqrt2
    assert dirac_serializer.serialize([inv_sqrt2, phase_neg_3pi_4], num_qubits=1) == "(|0⟩ + e^(-i3π/4)|1⟩)/√2"

def test_dirac_fallback_unsupported_phase(dirac_serializer):
    inv_sqrt2 = 1 / math.sqrt(2)
    # Some arbitrary phase like pi/8 that is not currently explicitly handled
    angle = math.pi / 8
    unsupported_phase = complex(math.cos(angle), math.sin(angle)) * inv_sqrt2
    assert dirac_serializer.serialize([inv_sqrt2, unsupported_phase], num_qubits=1) is None

def test_dirac_empty_state(dirac_serializer):
    assert dirac_serializer.serialize([]) is None
    assert dirac_serializer.serialize([0.0, 0.0]) is None

def test_dirac_too_many_terms(dirac_serializer):
    # More than 4 terms should return None
    state = [1/math.sqrt(8)] * 8
    assert dirac_serializer.serialize(state, num_qubits=3) is None
