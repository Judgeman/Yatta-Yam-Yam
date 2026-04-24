package com.nameapp.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DatabaseMigration implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            // Find and drop any check constraints on FOOD_ORDER to allow new enum values
            jdbcTemplate.queryForList(
                    "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
                            "WHERE TABLE_NAME = 'FOOD_ORDER' AND CONSTRAINT_TYPE = 'CHECK'"
            ).forEach(row -> {
                String name = (String) row.get("CONSTRAINT_NAME");
                try {
                    jdbcTemplate.execute(
                            "ALTER TABLE FOOD_ORDER DROP CONSTRAINT IF EXISTS \"" + name + "\"");
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {
            // Table doesn't exist yet on first run
        }
    }
}