package com.nameapp.config;

import com.nameapp.model.AppUser;
import com.nameapp.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import java.util.List;

/**
 * Adds what the logged-in user still owes to every page that is rendered for them
 * ("user" in the model). The navbar shows it as a red badge next to the name, so
 * people get reminded on whatever page a shared link brings them to.
 */
@Component
public class OpenDebtInterceptor implements HandlerInterceptor {

    private final OrderService orderService;

    public OpenDebtInterceptor(OrderService orderService) {
        this.orderService = orderService;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response,
                           Object handler, ModelAndView modelAndView) {
        if (modelAndView == null) return;
        String viewName = modelAndView.getViewName();
        if (viewName == null || viewName.startsWith("redirect:")) return;

        Object user = modelAndView.getModel().get("user");
        if (!(user instanceof AppUser)) return;

        List<OrderService.OpenDebt> openDebts = orderService.getOpenDebts((AppUser) user);
        modelAndView.addObject("openDebts", openDebts);
        modelAndView.addObject("openDebtTotal", OrderService.totalOf(openDebts));
    }
}
