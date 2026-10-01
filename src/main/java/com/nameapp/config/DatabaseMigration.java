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
        // Tables with enum columns (status, location) whose check constraints
        // would otherwise block newly added enum values
        for (String table : new String[]{"FOOD_ORDER", "CONTACT"}) {
            dropCheckConstraints(table);
        }
    }

    private void dropCheckConstraints(String table) {
        try {
            jdbcTemplate.queryForList(
                    "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS " +
                            "WHERE TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'", table
            ).forEach(row -> {
                String name = (String) row.get("CONSTRAINT_NAME");
                try {
                    jdbcTemplate.execute(
                            "ALTER TABLE " + table + " DROP CONSTRAINT IF EXISTS \"" + name + "\"");
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {
            // Table doesn't exist yet on first run
        }
    }
}