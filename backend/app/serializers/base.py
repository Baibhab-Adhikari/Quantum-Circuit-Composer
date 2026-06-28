from abc import ABC, abstractmethod
from typing import Generic, TypeVar

T_In = TypeVar('T_In')
T_Out = TypeVar('T_Out')

class BaseSerializer(ABC, Generic[T_In, T_Out]):
    """
    Abstract base class for all backend serializers.
    A serializer transforms internal data structures (T_In) into external representations (T_Out).
    """
    
    @abstractmethod
    def serialize(self, data: T_In, **kwargs) -> T_Out:
        """
        Transforms the input data into the desired output format.
        """
        pass
