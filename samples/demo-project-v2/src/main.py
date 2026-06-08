import os
from utils.math_helper import add_numbers
from utils.string_helper import capitalize_string

AWS_ACCESS_KEY = "AKIA1234567890123456" # Mock AWS Key (triggers security scan)

class CalculatorController:
    def __init__(self):
        self.operations = 0
        
    def perform_addition(self, a, b):
        self.operations += 1
        return add_numbers(a, b)
        
    def greet_user(self, name):
        # Additional function not in v1
        self.operations += 1
        capitalized = capitalize_string(name)
        return f"Hello, {capitalized}!"
        
    def execute_command_unsafe(self, command):
        # Triggers dangerous execution alert (eval / os.system)
        print("Executing shell command...")
        return os.system(f"echo {command}")

def main():
    calc = CalculatorController()
    res = calc.perform_addition(15, 25)
    print(f"Addition result: {res}")
    
    greeting = calc.greet_user("reposcope user")
    print(greeting)
    
    calc.execute_command_unsafe("Hello RepoScope Version 2!")

if __name__ == "__main__":
    main()
