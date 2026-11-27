package com.nameapp.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * A message in the chat of the Symbolics command line (CHAT, WALL; see ChatService).
 * The author's name is stored as it was when the message was sent.
 */
@Entity
@Table(name = "chat_message")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String author;

    @Column(nullable = false, length = 500)
    private String text;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public ChatMessage() {
    }

    public ChatMessage(String author, String text) {
        this.author = author;
        this.text = text;
    }

    public Long getId() {
        return id;
    }

    public String getAuthor() {
        return author;
    }

    public String getText() {
        return text;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
