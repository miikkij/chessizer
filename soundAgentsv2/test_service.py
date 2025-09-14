#!/usr/bin/env python3
"""
Test script for the Chess Sound WAV Generator microservice
"""

import requests
import json
import sys
from pathlib import Path

# Load sample configuration
config_path = Path(__file__).parent / "sample_config.json"
with open(config_path) as f:
    sample_config = json.load(f)

# Test FEN positions
test_positions = {
    "starting_position": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "middle_game": "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4",
    "endgame": "8/8/8/8/8/3K4/8/3k4 w - - 0 1",
    "check_position": "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3"
}

def test_microservice():
    """Test the microservice with different chess positions"""
    base_url = "http://localhost:8001"
    
    print("🎵 Testing Chess Sound WAV Generator Microservice")
    print("=" * 50)
    
    # Test health check
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            print("✅ Health check passed")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to microservice: {e}")
        print("   Make sure the Python server is running on port 8001")
        print("   Run: cd soundAgentsv2 && python main.py")
        return False
    
    print()
    
    # Test WAV generation for each position
    for name, fen in test_positions.items():
        print(f"🎼 Testing position: {name}")
        print(f"   FEN: {fen}")
        
        try:
            # Create request payload
            payload = {
                "fen": fen,
                "config": sample_config
            }
            
            # Send request
            response = requests.post(
                f"{base_url}/generate",
                json=payload,
                timeout=30,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                # Save WAV file
                wav_filename = f"test_{name}.wav"
                with open(wav_filename, 'wb') as f:
                    f.write(response.content)
                
                file_size = len(response.content)
                print(f"   ✅ Generated {file_size:,} byte WAV file: {wav_filename}")
                
                # Verify it's a valid WAV file
                if response.content[:4] == b'RIFF' and response.content[8:12] == b'WAVE':
                    print(f"   ✅ Valid WAV file format detected")
                else:
                    print(f"   ⚠️  File may not be a valid WAV format")
                    
            else:
                print(f"   ❌ Generation failed: {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data.get('detail', 'Unknown error')}")
                    except:
                        print(f"   Error content: {response.content.decode()[:200]}")
                        
        except requests.exceptions.Timeout:
            print(f"   ❌ Request timed out (30s)")
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request failed: {e}")
        except Exception as e:
            print(f"   ❌ Unexpected error: {e}")
        
        print()
    
    print("🎵 Test completed!")
    print("   Generated WAV files can be played with any audio player")
    return True

def test_config_variations():
    """Test different configuration variations"""
    print("🔧 Testing configuration variations")
    print("=" * 50)
    
    base_config = sample_config.copy()
    fen = test_positions["starting_position"]
    
    variations = [
        {
            "name": "Fast tempo",
            "changes": {"groove": {**base_config["groove"], "tempoBpm": 160}},
            "filename": "test_fast_tempo.wav"
        },
        {
            "name": "Long clip",
            "changes": {"audio": {**base_config["audio"], "lengthMs": 6000}},
            "filename": "test_long_clip.wav"
        },
        {
            "name": "Minimal voices",
            "changes": {"limits": {**base_config["limits"], "maxConcurrentVoices": 2}},
            "filename": "test_minimal.wav"
        }
    ]
    
    for variation in variations:
        print(f"🎛️  Testing: {variation['name']}")
        
        # Create modified config
        test_config = base_config.copy()
        test_config.update(variation["changes"])
        
        try:
            response = requests.post(
                "http://localhost:8001/generate",
                json={"fen": fen, "config": test_config},
                timeout=30
            )
            
            if response.status_code == 200:
                with open(variation["filename"], 'wb') as f:
                    f.write(response.content)
                print(f"   ✅ Generated: {variation['filename']}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")
        
        print()

if __name__ == "__main__":
    if test_microservice():
        if len(sys.argv) > 1 and sys.argv[1] == "--extended":
            test_config_variations()
        else:
            print("Run with --extended flag to test configuration variations")