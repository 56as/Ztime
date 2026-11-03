package org.timeledger.app;

import java.time.*;

final class PhoneSchedule {
    interface Interval { void accept(long start,long end) throws Exception; }

    // An overnight window belongs to the day on which it starts.
    static void keep(long start,long end,ZoneId zone,String repeat,LocalTime from,LocalTime to,Interval kept) throws Exception {
        LocalDate last=Instant.ofEpochMilli(end).atZone(zone).toLocalDate();
        LocalDate first=Instant.ofEpochMilli(start).atZone(zone).toLocalDate().minusDays(1);
        for(LocalDate day=first;!day.isAfter(last) && start<end;day=day.plusDays(1)){
            boolean weekend=day.getDayOfWeek().getValue()>5;
            if((repeat.equals("weekdays")&&weekend)||(repeat.equals("weekends")&&!weekend))continue;
            long a=day.atTime(from).atZone(zone).toInstant().toEpochMilli();
            LocalDate endDate=to.isAfter(from)?day:day.plusDays(1);
            long b=endDate.atTime(to).atZone(zone).toInstant().toEpochMilli();
            if(b<=start||a>=end)continue;
            if(start<a)kept.accept(start,a);
            start=Math.max(start,b);
        }
        if(start<end)kept.accept(start,end);
    }
}
