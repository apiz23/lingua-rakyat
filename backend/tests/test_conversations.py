import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch
import utils.chat_history as ch

_ROWS = [
    {"session_id": "s1", "question": "Passport fee?",    "created_at": "2026-06-12T10:00:00Z"},
    {"session_id": "s2", "question": "KWSP question",    "created_at": "2026-06-12T09:00:00Z"},
    {"session_id": "s1", "question": "First question s1","created_at": "2026-06-12T08:00:00Z"},
]

def test_groups_by_session():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    assert len(convs) == 2

def test_title_is_earliest_question():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    s1 = next(c for c in convs if c["session_id"] == "s1")
    assert s1["title"] == "First question s1"

def test_ordered_by_last_at_desc():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    assert convs[0]["session_id"] == "s1"  # last_at 10:00 > 09:00

def test_count_is_correct():
    with patch.object(ch, "list_chat_messages", return_value=_ROWS):
        convs = ch.list_conversations("user1")
    s1 = next(c for c in convs if c["session_id"] == "s1")
    assert s1["count"] == 2

def test_empty_user_returns_empty():
    with patch.object(ch, "list_chat_messages", return_value=[]):
        convs = ch.list_conversations("nobody")
    assert convs == []
