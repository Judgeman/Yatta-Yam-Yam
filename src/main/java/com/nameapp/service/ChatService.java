package com.nameapp.service;

import com.nameapp.model.AppUser;
import com.nameapp.model.ChatMessage;
import com.nameapp.repository.ChatMessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The chat of the Symbolics command line: one shared channel (#lunch) for everyone who is
 * logged in. The browser polls for new messages (see js/symbolics-chat.js); every poll
 * also counts as "online" for WHO. Messages are kept for 30 days.
 */
@Service
public class ChatService {

    public static final int MAX_LENGTH = 500;
    static final Duration KEEP = Duration.ofDays(30);
    static final Duration ONLINE = Duration.ofSeconds(90);
    static final int BURST = 5;
    static final Duration BURST_WINDOW = Duration.ofSeconds(5);

    /** Someone who polled within the last 90 seconds, and for how long they have not written */
    public record Presence(String name, long idleSeconds) {}

    /** Thrown when someone writes more than 5 messages within 5 seconds */
    public static class TooFastException extends RuntimeException {
        private final long retryAfterMillis;

        public TooFastException(long retryAfterMillis) {
            super("Too many messages");
            this.retryAfterMillis = retryAfterMillis;
        }

        /** When the next message would be accepted */
        public long getRetryAfterMillis() {
            return retryAfterMillis;
        }
    }

    /** at: the last poll; active: the last message, or when they came online */
    private record Seen(String name, Instant at, Instant active) {}

    private final ChatMessageRepository repository;
    private final Map<String, Seen> lastSeen = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> recentPosts = new ConcurrentHashMap<>();

    public ChatService(ChatMessageRepository repository) {
        this.repository = repository;
    }

    /** The latest 50 messages (afterId null), or up to 100 that came after afterId; oldest first */
    public List<ChatMessage> messagesAfter(Long afterId) {
        if (afterId == null) {
            List<ChatMessage> latest = new ArrayList<>(repository.findTop50ByOrderByIdDesc());
            Collections.reverse(latest);
            return latest;
        }
        return repository.findTop100ByIdGreaterThanOrderByIdAsc(afterId);
    }

    @Transactional
    public ChatMessage post(AppUser user, String text) {
        String clean = clean(text);
        if (clean.isEmpty()) throw new IllegalArgumentException("Empty message");

        checkRate(user);
        repository.deleteByCreatedAtBefore(LocalDateTime.now().minus(KEEP));
        ChatMessage saved = repository.save(new ChatMessage(user.getName(), clean));
        Instant at = Instant.now();
        lastSeen.put(key(user), new Seen(user.getName(), at, at));
        return saved;
    }

    private void checkRate(AppUser user) {
        Instant now = Instant.now();
        Deque<Instant> times = recentPosts.computeIfAbsent(key(user), key -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst().plus(BURST_WINDOW).isBefore(now)) {
                times.pollFirst();
            }
            if (times.size() >= BURST) {
                throw new TooFastException(Duration.between(now, times.peekFirst().plus(BURST_WINDOW)).toMillis() + 50);
            }
            times.addLast(now);
        }
    }

    /** One line without control characters, at most MAX_LENGTH characters */
    static String clean(String text) {
        if (text == null) return "";
        String line = text.replaceAll("\\p{Cntrl}", " ").replaceAll("\\s+", " ").trim();
        if (line.codePointCount(0, line.length()) > MAX_LENGTH) {
            line = line.substring(0, line.offsetByCodePoints(0, MAX_LENGTH)).trim();
        }
        return line;
    }

    public void seen(AppUser user) {
        Instant now = Instant.now();
        lastSeen.compute(key(user), (key, seen) -> new Seen(user.getName(), now,
                seen != null && seen.at().plus(ONLINE).isAfter(now) ? seen.active() : now));
    }

    private static String key(AppUser user) {
        return user.getName().toLowerCase(Locale.ROOT);
    }

    /** Who polled within the last 90 seconds, by name */
    public List<Presence> online() {
        Instant now = Instant.now();
        lastSeen.values().removeIf(seen -> seen.at().plus(ONLINE).isBefore(now));
        return lastSeen.values().stream()
                .map(seen -> new Presence(seen.name(), Duration.between(seen.active(), now).toSeconds()))
                .sorted(Comparator.comparing(presence -> presence.name().toLowerCase(Locale.ROOT)))
                .toList();
    }
}
