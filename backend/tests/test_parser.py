import os
import tempfile
import pytest
from app import parser

def test_parse_python_file():
    code = """
import os
from sys import path
class MyClass(Base):
    def method_one(self, x):
        pass
    async def method_two(self):
        pass
def root_function():
    pass
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, "test.py")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
            
        symbols, deps = parser.parse_python_file(file_path, tmpdir)
        
        # Verify symbols
        types = [s["type"] for s in symbols]
        names = [s["name"] for s in symbols]
        
        assert "class" in types
        assert "MyClass" in names
        assert "method_one" in names
        assert "method_two" in names
        assert "root_function" in names
        
        # Verify imports
        imports = [d["target_file"] for d in deps]
        assert "os" in imports
        assert "sys.path" in imports

def test_parse_lexical_file_js():
    code = """
import React from 'react';
const { useState } = require('react');
export class Button extends Component {
  render() {
    return <button />;
  }
}
export function helper(arg) {}
const callback = (x) => x;
"""
    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, "test.js")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(code)
            
        symbols, deps = parser.parse_lexical_file(file_path, tmpdir, "JavaScript")
        
        names = [s["name"] for s in symbols]
        assert "Button" in names
        assert "helper" in names
        assert "callback" in names
        
        targets = [d["target_file"] for d in deps]
        assert "react" in targets

def test_import_resolution():
    all_files = [
        "src/main.py",
        "src/utils/helpers.py",
        "src/config.py"
    ]
    raw_deps = [
        {
            "source_file": "src/main.py",
            "target_file": "./config",
            "import_path": "import config",
            "type": "import"
        },
        {
            "source_file": "src/main.py",
            "target_file": "utils.helpers",
            "import_path": "from utils import helpers",
            "type": "import"
        }
      ]
    resolved = parser.resolve_imports(raw_deps, all_files)
    targets = [r["target_file"] for r in resolved]
    
    assert "src/config.py" in targets
    assert "src/utils/helpers.py" in targets
