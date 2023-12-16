import { h, Component } from 'preact';
import { connect } from 'unistore/preact';
import { Link } from 'preact-router/match';
import { pluralise } from '../../utils/pluralise';
import {
  url,
  double,
  getOffsetToMonday,
  getOffsetToYear,
} from '../../utils/date';
import { stopWords } from '../../utils/stat';
import { getTrackingQuestions, isAnswerValid } from '../../utils/questions';

const today = url();

class Stats extends Component {
  state = {
    totalEntries: 0,
    uniqueDates: 0,
    wordCount: 0,
    totalHighlights: 0,
    totalTrackingEntries: 0,
    popularWords: [],
    showPopularWords: false,
    showStopWords: false,
    trackingQuestions: [],
    statOffset: 0,
  };

  componentDidMount() {
    this.getData();
  }

  componentWillReceiveProps() {
    this.getData();
  }

  getData = async () => {
    try {
      const keysData = await this.props.db.keys('entries');
      const totalEntries = keysData.length;

      // Prepare the keys
      const keys = keysData.map(key => Number(key.split('_').shift()));
      keys.sort((a, b) => a - b);

      const unique = keys.reduce(this.removeDuplicates, []);

      // Highlights
      const highlights = await this.props.db.getAll('highlights');
      const totalHighlights = highlights.length;

      const [wordCount, popularWords] = await this.getPopularWords();

      const [
        trackingQuestions,
        totalTrackingEntries,
      ] = await this.getTrackingStats();

      this.setState({
        totalEntries,
        uniqueDates: unique.length,
        wordCount,
        totalHighlights,
        popularWords,
        trackingQuestions,
        totalTrackingEntries,
      });
    } catch (e) {
      // console.error(e);
    }
  };

  getTrackingStats = async () => {
    const questions = await getTrackingQuestions(this.props.db);
    const answers = await this.props.db.getAll('trackingEntries');

    const now = new Date();
    const { statOffset } = this.state;
    const nowNumber = `${now.getFullYear()}${double(
      now.getMonth() + 1
    )}${double(now.getDate())}`;
    const dateFrom = statOffset ? nowNumber - statOffset : 0;

    questions.forEach(question => {
      question.answers = answers
        .filter(x => x.questionId === question.id)
        .filter(x => x.value !== question.default)
        .filter(answer => {
          if (!dateFrom) {
            return true;
          }

          return Number(answer.dateString) >= dateFrom;
        });

      switch (question.settings.calculation) {
        case 'average':
          question.instances = question.answers;
          question.stat =
            Math.round(
              (question.answers.reduce((c, x) => c + x.value, 0) /
                question.answers.length) *
                1000
            ) / 1000;
          break;
        case 'total':
          question.stat =
            Math.round(
              question.answers.reduce((c, x) => c + x.value, 0) * 1000
            ) / 1000;
          break;
        case 'count':
          question.instances = question.answers.filter(isAnswerValid);
          question.stat = question.instances.length;
          break;
      }

      if (isNaN(question.stat)) {
        question.stat = undefined;
      }
    });

    return [questions.filter(x => x.stat !== undefined), answers.length];
  };

  getPopularWords = async () => {
    // Word count
    const theWords = {};
    const entries = await this.props.db.getAll('entries');
    const noteEntries = await this.props.db
      .getAll('trackingEntries')
      .then(results => {
        return results.map(x => x.notes || '');
      });

    const wordCount = [...entries, ...noteEntries].reduce((c, entry) => {
      const words = entry
        .split(/[.\s,]+/)
        .map(x => x.toLowerCase())
        .filter(Boolean);

      words
        .filter(x => this.state.showStopWords || !stopWords.includes(x))
        .forEach(w => (theWords[w] = theWords[w] ? theWords[w] + 1 : 1));

      return c + words.length;
    }, 0);

    const highestValues = Array.from(
      new Set(Object.values(theWords).sort((a, b) => b - a))
    );
    const popularWords = highestValues.slice(0, 50).map(v => [
      v,
      Object.keys(theWords)
        .filter(k => theWords[k] === v)
        .join(', '),
    ]);

    return [wordCount, popularWords];
  };

  removeDuplicates(c, date) {
    return c.indexOf(date) === -1 ? [...c, date] : c;
  }

  render(
    {},
    {
      totalEntries,
      uniqueDates,
      wordCount,
      totalHighlights,
      totalTrackingEntries,
      popularWords,
      showPopularWords,
      showStopWords,
      trackingQuestions,
      statOffset,
    }
  ) {
    const thisWeek = getOffsetToMonday();
    const thisMonth = new Date().getDate() - 1;
    const thisYear = getOffsetToYear();

    const stats = (
      <div>
        {wordCount ? (
          <p>
            You've written <strong>{wordCount}</strong>{' '}
            {pluralise('word', wordCount)} in{' '}
            <strong>
              {totalEntries} {pluralise('entry', totalEntries, 'entries')}
            </strong>{' '}
            over{' '}
            <strong>
              {uniqueDates} {pluralise('day', uniqueDates)}
            </strong>
            !
          </p>
        ) : null}
        {totalHighlights ? (
          <p>
            You've also highlighted <strong>{totalHighlights}</strong>{' '}
            {pluralise('day', totalHighlights)}. Check{' '}
            {pluralise('it', totalHighlights, 'them')} out{' '}
            <Link href="/highlights/">here</Link>.
          </p>
        ) : null}

        {showPopularWords && popularWords.length ? (
          <div>
            <p>Your most popular words are:</p>
            <table class="left">
              <tbody>
                {popularWords.map(([v, k]) => (
                  <tr key={k}>
                    <th>{v}</th>
                    <td class="capitalize">{k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <br />
            {!showStopWords ? (
              <button
                type="button"
                class="button button--grey"
                onClick={() => {
                  this.setState({ showStopWords: true });
                  this.getData();
                }}
              >
                Include stop words
              </button>
            ) : null}
          </div>
        ) : wordCount ? (
          <button
            type="button"
            class="button button--grey"
            onClick={() => this.setState({ showPopularWords: true })}
          >
            Show popular words
          </button>
        ) : null}

        {totalTrackingEntries ? (
          <div class="mb40">
            <hr />
            <header class="c-statistic-controls u-flex mb20">
              <h2>Personal Statistics</h2>
              <select
                class="c-select--small"
                value={statOffset}
                onChange={event => {
                  this.setState({ statOffset: Number(event.target.value) });
                  this.getData();
                }}
              >
                <option value="0">All time</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="365">365 days</option>
                <option value={thisWeek}>This week</option>
                <option value={thisMonth}>This month</option>
                <option value={thisYear}>This year</option>
              </select>
            </header>

            <p>
              You've tracked {totalTrackingEntries} personal{' '}
              {pluralise('statistic', totalTrackingEntries)} on JournalBook.
            </p>

            {trackingQuestions.map(question => (
              <div class="tracking-summary">
                <strong>{question.title}</strong>
                <span class="tracking-summary__stat">
                  <output>{question.stat}</output>
                  <small> ({question.settings.calculation})</small>
                </span>
                {question.instances && question.instances.length ? (
                  <Link href={`/entries/${question.id}`}>See all entries</Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <Link href="/add-statistic-question/" class="button">
              Add a personal statistic to track
            </Link>
          </div>
        )}
      </div>
    );

    const empty = (
      <p>
        There's not quite enough data to get gather stats -{' '}
        <Link href={today}>keep writing</Link>!
      </p>
    );

    const isEmpty =
      Math.min(totalEntries, uniqueDates, wordCount) === 0 &&
      !totalTrackingEntries;

    return (
      <div class="wrap wrap--thin lift-children">
        <h1 class="mb20">Activity log</h1>
        <div>{isEmpty ? empty : stats}</div>
      </div>
    );
  }
}

export default connect('db')(Stats);
