package com.nameapp.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final OpenDebtInterceptor openDebtInterceptor;

    public WebConfig(OpenDebtInterceptor openDebtInterceptor) {
        this.openDebtInterceptor = openDebtInterceptor;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:uploads/");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(openDebtInterceptor);
    }
}
