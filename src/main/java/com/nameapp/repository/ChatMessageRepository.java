package com.nameapp.repository;

import com.nameapp.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /** The latest messages, newest first (for opening the chat) */
    List<ChatMessage> findTop50ByOrderByIdDesc();

    /** What came after the given message, oldest first (for polling) */
    List<ChatMessage> findTop100ByIdGreaterThanOrderByIdAsc(Long id);

    long deleteByCreatedAtBefore(LocalDateTime time);
}
