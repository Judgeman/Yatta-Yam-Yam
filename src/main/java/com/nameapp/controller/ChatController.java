package com.nameapp.controller;

import com.nameapp.model.AppUser;
import com.nameapp.model.ChatMessage;
import com.nameapp.service.AppUserService;
import com.nameapp.service.ChatService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * JSON endpoints for the chat of the Symbolics command line (js/symbolics-chat.js).
 * Only for logged-in users; the POST needs the CSRF token, which fragments/theme.html
 * puts into every page.
 */
@Controller
@RequestMapping("/chat")
public class ChatController {

    public record MessageView(long id, String author, String text, long time) {
        static MessageView of(ChatMessage message) {
            return new MessageView(message.getId(), message.getAuthor(), message.getText(),
                    message.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
        }
    }

    public record ChatView(String me, List<MessageView> messages, List<ChatService.Presence> online) {}

    public record NewMessage(String text) {}

    private final ChatService chatService;
    private final AppUserService userService;

    public ChatController(ChatService chatService, AppUserService userService) {
        this.chatService = chatService;
        this.userService = userService;
    }

    // Same as in the other controllers: the user from the nameapp_user cookie
    private Optional<AppUser> currentUser(HttpServletRequest request) {
        if (request.getCookies() == null) return Optional.empty();
        return Arrays.stream(request.getCookies())
                .filter(c -> "nameapp_user".equals(c.getName()))
                .map(c -> {
                    try {
                        String name = java.net.URLDecoder.decode(c.getValue(), java.nio.charset.StandardCharsets.UTF_8);
                        return userService.findByName(name).orElse(null);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .findFirst();
    }

    /** The latest messages, or the ones after "after"; also who is online. Counts as being online. */
    @GetMapping("/messages")
    @ResponseBody
    public ResponseEntity<ChatView> messages(HttpServletRequest request, @RequestParam(required = false) Long after) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        chatService.seen(user.get());
        List<MessageView> messages = chatService.messagesAfter(after).stream().map(MessageView::of).toList();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new ChatView(user.get().getName(), messages, chatService.online()));
    }

    @PostMapping("/messages")
    @ResponseBody
    public ResponseEntity<?> post(HttpServletRequest request, @RequestBody NewMessage message) {
        Optional<AppUser> user = currentUser(request);
        if (user.isEmpty()) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(MessageView.of(chatService.post(user.get(), message.text())));
        } catch (ChatService.TooFastException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "Too fast", "retryAfter", e.getRetryAfterMillis()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
