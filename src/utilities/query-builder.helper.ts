export class QueryBuilderHelper {
  public static dateHrQtr(dateHrQtrValue: string, beginDate: boolean) {
    if (String(dateHrQtrValue).match(/^\d{4}\sQ[1-4]$/) != null) {
      const dateValue = dateHrQtrValue.split(' Q');
      const month = beginDate
        ? parseInt(dateValue[1]) * 3 - 3
        : parseInt(dateValue[1]) * 3;
      const year = parseInt(dateValue[0]);
      const day = beginDate ? 1 : 0;
      const date = new Date(year, month, day);
      return date;
    } else {
      const dateValue = dateHrQtrValue.split(' ');
      const date = new Date(`${dateValue[0]}`);
      if (dateValue[1]) {
        date.setHours(date.getHours() + parseInt(`${dateValue[1]}`));
      }
      return date;
    }
  }

  public static addDateAfter(query: any, dateHrQtrValue: string) {
    const beginDate = this.dateHrQtr(dateHrQtrValue, true);
    query.andWhere('es.addDate >= :beginDate', {
      beginDate: beginDate,
    });
    return query;
  }

  public static addDateBefore(query: any, dateHrQtrValue: string) {
    const endDate = this.dateHrQtr(dateHrQtrValue, false);
    query.andWhere('es.addDate <= :endDate', { endDate: endDate });
    return query;
  }
}
