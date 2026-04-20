def normalize_draft(text: str, max_len: int = 280) -> str:
    t = text.strip()
    if len(t) <= max_len:
        return t
    return t[:max_len].rstrip()
