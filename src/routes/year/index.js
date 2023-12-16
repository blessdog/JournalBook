import { h, Component } from 'preact';
import { filledArray, months as monthNames, pad } from '../../utils/date';
import Traverse from '../../components/Traverse';
import { Link } from 'preact-router/match';
import { connect } from 'unistore/preact';

class Year extends Component {
  state = {
    months: filledArray(),
  };

  componentDidMount() {
    this.getData(this.props);
  }

  componentWillReceiveProps(props) {
    this.getData(props);
  }

  getData = async ({ year }) => {
    const date = new Date(year, 0, 1);

    if (date.toString() === 'Invalid Date') {
      window.location.href = `/${new Date().getFullYear()}`;
      return;
    }

    let dates = await this.props.db.keys('entries');
    const trackingEntries = await this.props.db.keys('trackingEntries');
    dates = [...dates, ...trackingEntries];

    const months = dates
      .map(x => x.split('_').shift())
      .filter(x => x.indexOf(String(year)) === 0)
      .reduce((current, date) => {
        const month = Number(date.substring(4, 6)) - 1;
        current[month]++;
        return current;
      }, filledArray());

    this.setState({ months });
  };

  render({ year }, { months }) {
    const lastYear = new Date(year, 0, 1);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    const nextYear = new Date(year, 0, 1);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    return (
      <div class="wrap lift-children">
        <Traverse
          title={year}
          lastLink={`/${lastYear.getFullYear()}`}
          nextLink={`/${nextYear.getFullYear()}`}
        />
        <ul class="year-overview">
          {months.map((count, month) => (
            <li key={month}>
              <Link
                href={`/${year}/${pad(month + 1)}`}
                class={`button button--${count ? 'active' : 'inactive'}`}
              >
                {monthNames[month]}{' '}
                <strong>
                  <b>{count}</b>
                </strong>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

export default connect('db')(Year);
