import requests
import json

url = 'http://localhost:8000/api/entry'
headers = {
    'Accept': '*/*',
    'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkFObGZRTk1OX2RjaWJzRWh2QjJxViJ9.eyJpc3MiOiJodHRwczovL2Rldi04NXlodGR4N3Y0eXpiYXBnLnVzLmF1dGgwLmNvbS8iLCJzdWIiOiJnb29nbGUtb2F1dGgyfDEwOTQzNjAwMzYxMjkwNTMyODU0MyIsImF1ZCI6WyJodHRwczovL2Rldi04NXlodGR4N3Y0eXpiYXBnLnVzLmF1dGgwLmNvbS9hcGkvdjIvIiwiaHR0cHM6Ly9kZXYtODV5aHRkeDd2NHl6YmFwZy51cy5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzc0NzMxODUxLCJleHAiOjE3NzQ4MTgyNTEsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJhenAiOiJzODVybkRrR3B2dngxOG5VOVFzUG00aDdheVJ2ZGdpSCJ9.HKOB-QxfbCQZJpeJ2Ov6QZnWe9oDRYsfWAxKx42nDxlBU4kGVpzSgigTWKmgkVqKkkF4YUBFNwEgxCl11DxEn7_7hPcaOk2B48JPgs9rW-MySi_rswYSkX5Ua667S8vXhHfI8M7HQ_uPPyAY8TZECk9CPZDWvF7F9qSuRo1LVYSPMoWmvpAs5okjVEYDZY8VSTJbYWZ7Y79xQlHKBbT6uekHepcOsS3asUCe7oGQCC7grjX3juCkC1fO4Js31B7G1JJwARQkS4LzsuKq2fOh6UOJ9V1Gzl_xKSZaC-XngpbPYdSDigeU8jra9NY5LEgosnlVdMCf1_PEJo_xYw98rQ',
    'Content-Type': 'application/json'
}
data = {
    "text": "this is a brand new entry to test lava api"
}

try:
    r = requests.post(url, headers=headers, json=data)
    print(f"Status: {r.status_code}", flush=True)
    print(f"Body: {r.text}", flush=True)
except Exception as e:
    print(f"Error making request: {str(e)}")
