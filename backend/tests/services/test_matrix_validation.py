import pytest
from app.services.validation import validate_complex_matrix, validate_unitarity
from app.schemas.circuit import ComplexNumberSchema

def test_validate_complex_matrix_dimensions():
    # Valid 2x2
    valid = [
        [ComplexNumberSchema(real=1), ComplexNumberSchema(real=0)],
        [ComplexNumberSchema(real=0), ComplexNumberSchema(real=1)]
    ]
    is_valid, _ = validate_complex_matrix(valid)
    assert is_valid

    # Invalid - 1 row
    invalid1 = [[ComplexNumberSchema(real=1), ComplexNumberSchema(real=0)]]
    is_valid, msg = validate_complex_matrix(invalid1)
    assert not is_valid
    assert "2 rows" in msg

    # Invalid - 3 columns
    invalid2 = [
        [ComplexNumberSchema(real=1), ComplexNumberSchema(real=0), ComplexNumberSchema(real=0)],
        [ComplexNumberSchema(real=0), ComplexNumberSchema(real=1), ComplexNumberSchema(real=0)]
    ]
    is_valid, msg = validate_complex_matrix(invalid2)
    assert not is_valid
    assert "2 columns" in msg

def test_validate_unitarity():
    # Identity matrix (Unitary)
    identity = [
        [ComplexNumberSchema(real=1), ComplexNumberSchema(real=0)],
        [ComplexNumberSchema(real=0), ComplexNumberSchema(real=1)]
    ]
    is_valid, _ = validate_unitarity(identity)
    assert is_valid

    # Pauli-X (Unitary)
    pauli_x = [
        [ComplexNumberSchema(real=0), ComplexNumberSchema(real=1)],
        [ComplexNumberSchema(real=1), ComplexNumberSchema(real=0)]
    ]
    is_valid, _ = validate_unitarity(pauli_x)
    assert is_valid

    # Non-unitary
    non_unitary = [
        [ComplexNumberSchema(real=1), ComplexNumberSchema(real=1)],
        [ComplexNumberSchema(real=1), ComplexNumberSchema(real=1)]
    ]
    is_valid, msg = validate_unitarity(non_unitary)
    assert not is_valid
    assert "not unitary" in msg
