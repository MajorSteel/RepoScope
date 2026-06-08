import os
import tempfile
import pytest
from app import metrics

def test_complexity_calculation():
    code = """
def check_val(x):
    if x > 10:
        if x < 20:
            return "mid"
        else:
            return "high"
    for i in range(x):
        print(i)
    return "low"
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, "test.py")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
            
        cc = metrics.calculate_complexity(file_path, ".py")
        # Base: 1, If: 1, If: 1, For: 1. Total should be ~4 or more depending on keywords
        assert cc >= 3

def test_maintainability_index():
    # LOC=100, CC=5, size=2000
    mi = metrics.calculate_maintainability_index(100, 5, 2000)
    assert 0 <= mi <= 100
    
    # Empty file should yield 100
    mi_empty = metrics.calculate_maintainability_index(0, 1, 0)
    assert mi_empty == 100.0

def test_secret_scanning():
    # Mock line containing AWS access key
    code_with_aws = "AWS_KEY = 'AKIAIOSFODNN7EXAMPLE'"
    # Mock line containing normal key placeholder (should not trigger)
    code_with_placeholder = "API_KEY = '<your_key_here>'"
    
    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, "secrets.py")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"{code_with_aws}\n{code_with_placeholder}\n")
            
        vulns = metrics.scan_security_issues(file_path, "secrets.py", "Python")
        
        # Verify AWS key triggered
        severities = [v["severity"] for v in vulns]
        assert "Critical" in severities
        # Verify placeholder did not trigger
        descriptions = [v["description"] for v in vulns]
        assert not any("placeholder" in d for d in descriptions)
