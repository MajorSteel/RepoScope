def add_numbers(a, b):
    """Simple addition utility."""
    return a + b

def subtract_numbers(a, b):
    """Simple subtraction utility."""
    return a - b

def multiply_numbers(a, b):
    """Simple multiplication utility."""
    return a * b

def divide_numbers(a, b):
    """Simple division utility."""
    if b == 0:
        raise ValueError("Cannot divide by zero.")
    return a / b
