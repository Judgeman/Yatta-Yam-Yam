package com.nameapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.savedrequest.HttpSessionRequestCache;
import org.springframework.security.web.util.matcher.AndRequestMatcher;
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.Set;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // No CSRF check on the login form: the token lives in the server-side session,
                // so a login page that outlived its session (timeout, restart, restored tab)
                // was rejected silently and sent people back to /login. With a single shared
                // account, login CSRF gives an attacker nothing; all other forms stay protected.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/login"))
                .authorizeHttpRequests(auth -> auth
                        // /error is public so a failed request (e.g. a missing file) shows the error
                        // page instead of being remembered as the page to open after the password.
                        .requestMatchers("/css/**", "/js/**", "/images/**", "/uploads/**", "/version", "/error").permitAll()
                        .anyRequest().authenticated()
                )
                // Only page visits are remembered as the target after the password.
                .requestCache(cache -> cache.requestCache(pageVisitRequestCache()))
                .formLogin(form -> form
                        .loginPage("/login")
                        .defaultSuccessUrl("/", false)
                        .permitAll()
                )
                .logout(logout -> logout
                        .logoutSuccessUrl("/login?logout")
                        .permitAll()
                )
                .rememberMe(remember -> remember
                        .key("someSecretKey#1!89_:;")
                        .tokenValiditySeconds(365 * 24 * 60 * 60) // one year
                );
        return http.build();
    }

    /**
     * Before the password is entered, Spring Security stores the last protected request in
     * the session and redirects there after the login. By default that is any GET request,
     * so whatever the browser fetched in the background last (/apple-touch-icon.png,
     * /robots.txt, Chrome's /.well-known/appspecific/com.chrome.devtools.json, ...) replaced
     * the page someone actually wanted, and the login ended on a 404 page. Now only requests
     * that ask for an HTML page are stored: a browser sends "Accept: text/html" when it opens
     * a page, but not for icons, images, scripts or fetch calls (a bare "accept anything"
     * wildcard does not count).
     */
    private static HttpSessionRequestCache pageVisitRequestCache() {
        MediaTypeRequestMatcher acceptsHtml = new MediaTypeRequestMatcher(MediaType.TEXT_HTML);
        acceptsHtml.setIgnoredMediaTypes(Set.of(MediaType.ALL));

        RequestMatcher isGet = request -> "GET".equals(request.getMethod());
        RequestMatcher notXhr = request -> !"XMLHttpRequest".equals(request.getHeader("X-Requested-With"));

        HttpSessionRequestCache requestCache = new HttpSessionRequestCache();
        requestCache.setRequestMatcher(new AndRequestMatcher(isGet, acceptsHtml, notXhr));
        return requestCache;
    }
}
