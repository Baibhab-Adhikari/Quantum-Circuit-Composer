import math
from typing import Optional, List, Tuple
from app.serializers.base import BaseSerializer

class DiracSerializer(BaseSerializer[List[complex], Optional[str]]):
    """
    Serializes a raw statevector into a human-readable Dirac notation string.
    """
    
    EPSILON = 1e-5

    def _format_phase(self, norm_amp: complex) -> Optional[str]:
        """
        Formats a complex phase into a string prefix (e.g. '+ ', '- ', '+ i', '- i').
        Returns None if the phase is too complex to represent simply.
        """
        if abs(norm_amp.real - 1.0) < self.EPSILON and abs(norm_amp.imag) < self.EPSILON:
            return "+"
        elif abs(norm_amp.real + 1.0) < self.EPSILON and abs(norm_amp.imag) < self.EPSILON:
            return "-"
        elif abs(norm_amp.imag - 1.0) < self.EPSILON and abs(norm_amp.real) < self.EPSILON:
            return "+ i"
        elif abs(norm_amp.imag + 1.0) < self.EPSILON and abs(norm_amp.real) < self.EPSILON:
            return "- i"
        return None

    def serialize(self, data: List[complex], num_qubits: int = 1) -> Optional[str]:
        if not data:
            return None

        # Find all non-zero amplitudes
        terms: List[Tuple[int, complex]] = []
        for i, amp in enumerate(data):
            mag = abs(amp)
            if mag > self.EPSILON:
                terms.append((i, amp))

        if not terms or len(terms) > 4:
            return None

        # Check if all terms have the same magnitude
        first_mag = abs(terms[0][1])
        all_same_mag = all(abs(abs(amp) - first_mag) < self.EPSILON for _, amp in terms)

        common_factor_str = ""
        if all_same_mag:
            if abs(first_mag - 1.0) < self.EPSILON:
                pass # No common factor
            elif abs(first_mag - (1 / math.sqrt(2))) < self.EPSILON:
                common_factor_str = "/√2"
            elif abs(first_mag - 0.5) < self.EPSILON:
                common_factor_str = "/2"
            else:
                return None # Unrecognized common magnitude

        dirac_terms = []
        for i, amp in terms:
            bin_state = format(i, f'0{num_qubits}b')
            basis = f"|{bin_state}⟩"

            if all_same_mag and common_factor_str:
                norm_amp = amp / first_mag
                phase = self._format_phase(norm_amp)
                
                if phase is None:
                    return None
                    
                # Formatting tweaks (e.g. don't put '+' at the very beginning)
                if not dirac_terms and phase == "+":
                    dirac_terms.append(basis)
                elif not dirac_terms and phase == "+ i":
                    dirac_terms.append(f"i{basis}")
                elif not dirac_terms and phase == "-":
                    dirac_terms.append(f"-{basis}")
                elif not dirac_terms and phase == "- i":
                    dirac_terms.append(f"-i{basis}")
                else:
                    if phase.endswith("i"):
                        dirac_terms.append(f"{phase[0]} i{basis}")
                    else:
                        dirac_terms.append(f"{phase} {basis}")
            else:
                # If not all same mag, just handle pure real 1.0 and -1.0
                phase = self._format_phase(amp)
                if phase == "+":
                    dirac_terms.append(f"+ {basis}" if dirac_terms else basis)
                elif phase == "-":
                    dirac_terms.append(f"- {basis}" if dirac_terms else f"-{basis}")
                else:
                    return None

        if not dirac_terms:
            return None

        inner = " ".join(dirac_terms)
        
        if common_factor_str:
            if len(dirac_terms) > 1:
                return f"({inner}){common_factor_str}"
            else:
                return f"{inner}{common_factor_str}"
        
        return inner
