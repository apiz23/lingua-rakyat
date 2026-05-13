# backend/scripts/download_sample_docs.py
"""
One-time script to download pre-approved Malaysian government PDFs.
Run: python backend/scripts/download_sample_docs.py
PDFs are saved to backend/sample_docs/. Files > 5MB are excluded from git.
"""
import os
import urllib.request

SAMPLE_DOCS = [
    {
        "doc_id": "lhdn-efiling-2024",
        "filename": "lhdn-efiling-2024.pdf",
        "url": None,  # Set LHDN_PDF_URL env var or place PDF manually in sample_docs/
    },
    {
        "doc_id": "kwsp-pengeluaran",
        "filename": "kwsp-pengeluaran.pdf",
        "url": None,  # Set KWSP_PDF_URL env var
    },
    {
        "doc_id": "jpn-mykad-faq",
        "filename": "jpn-mykad-faq.pdf",
        "url": None,  # Set JPN_PDF_URL env var
    },
    {
        "doc_id": "ptptn-peminjam",
        "filename": "ptptn-peminjam.pdf",
        "url": None,  # Set PTPTN_PDF_URL env var
    },
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_docs")

def download_all():
    os.makedirs(OUT_DIR, exist_ok=True)
    for doc in SAMPLE_DOCS:
        dest = os.path.join(OUT_DIR, doc["filename"])
        if os.path.exists(dest):
            print(f"  [skip] {doc['filename']} already exists")
            continue
        url = doc["url"] or os.getenv(doc["doc_id"].upper().replace("-", "_") + "_PDF_URL")
        if not url:
            print(f"  [skip] {doc['filename']} — no URL configured. Place PDF manually in backend/sample_docs/")
            continue
        print(f"  Downloading {doc['filename']}...")
        urllib.request.urlretrieve(url, dest)
        size_mb = os.path.getsize(dest) / (1024 * 1024)
        print(f"  Done ({size_mb:.1f} MB)")

if __name__ == "__main__":
    download_all()
