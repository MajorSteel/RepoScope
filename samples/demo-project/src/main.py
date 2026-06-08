import os
from utils.math_helper import add_numbers

AWS_ACCESS_KEY = "AKIA1234567890123456" # Mock AWS Key (triggers security scan)

class CalculatorController:
    def __init__(self):
        self.operations = 0
        
    def perform_addition(self, a, b):
        self.operations += 1
        return add_numbers(a, b)
        
    def execute_command_unsafe(self, command):
        # Triggers dangerous execution alert (eval / os.system)
        print("Executing shell command...")
        return os.system(f"echo {command}")

def main():
    calc = CalculatorController()
    res = calc.perform_addition(10, 20)
    print(f"Addition result: {res}")
    
    # Trigger dangerous command
    calc.execute_command_unsafe("Hello RepoScope!")

if __name__ == "__main__":
    main()
